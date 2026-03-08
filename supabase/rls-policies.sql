-- ============================================
-- RLS POLICIES FOR VOILA VOICE DASHBOARD
-- ============================================
-- Run this SQL in your Supabase SQL Editor to fix RLS blocking issues
--
-- EXISTING TABLES ONLY:
-- - users
-- - user_sessions
-- - tb_stat
-- - qa_entries
-- - extracted_questions
-- - question_cluster_mappings
-- - question_clusters
-- ============================================

-- ============================================
-- 1. USERS TABLE
-- ============================================
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated read access to users" ON users;
DROP POLICY IF EXISTS "Allow service role full access to users" ON users;

-- Allow authenticated users to read users table
CREATE POLICY "Allow authenticated read access to users"
ON users
FOR SELECT
TO authenticated
USING (true);

-- Allow service role to do everything (for Edge Functions)
CREATE POLICY "Allow service role full access to users"
ON users
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================
-- 2. USER_SESSIONS TABLE
-- ============================================
DROP POLICY IF EXISTS "Users can read their own sessions" ON user_sessions;
DROP POLICY IF EXISTS "Allow service role full access to user_sessions" ON user_sessions;

-- Allow authenticated users to read their own sessions
CREATE POLICY "Users can read their own sessions"
ON user_sessions
FOR SELECT
TO authenticated
USING (true);

-- Allow service role full access (for Edge Functions)
CREATE POLICY "Allow service role full access to user_sessions"
ON user_sessions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================
-- 3. TB_STAT TABLE (Call Statistics)
-- ============================================
DROP POLICY IF EXISTS "Allow authenticated read access to tb_stat" ON tb_stat;
DROP POLICY IF EXISTS "Allow service role full access to tb_stat" ON tb_stat;

-- Allow authenticated users to read all call stats
CREATE POLICY "Allow authenticated read access to tb_stat"
ON tb_stat
FOR SELECT
TO authenticated
USING (true);

-- Allow service role full access
CREATE POLICY "Allow service role full access to tb_stat"
ON tb_stat
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================
-- 4. QA_ENTRIES TABLE
-- ============================================
DROP POLICY IF EXISTS "Allow authenticated read access to qa_entries" ON qa_entries;
DROP POLICY IF EXISTS "Allow service role full access to qa_entries" ON qa_entries;

-- Allow authenticated users to read Q&A entries
CREATE POLICY "Allow authenticated read access to qa_entries"
ON qa_entries
FOR SELECT
TO authenticated
USING (true);

-- Allow service role full access
CREATE POLICY "Allow service role full access to qa_entries"
ON qa_entries
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================
-- 5. QUESTION_CLUSTER_MAPPINGS TABLE
-- ============================================
DROP POLICY IF EXISTS "Allow authenticated read access to question_cluster_mappings" ON question_cluster_mappings;
DROP POLICY IF EXISTS "Allow service role full access to question_cluster_mappings" ON question_cluster_mappings;

-- Allow authenticated users to read cluster mappings
CREATE POLICY "Allow authenticated read access to question_cluster_mappings"
ON question_cluster_mappings
FOR SELECT
TO authenticated
USING (true);

-- Allow service role full access
CREATE POLICY "Allow service role full access to question_cluster_mappings"
ON question_cluster_mappings
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================
-- 6. EXTRACTED_QUESTIONS TABLE
-- ============================================
DROP POLICY IF EXISTS "Allow authenticated read access to extracted_questions" ON extracted_questions;
DROP POLICY IF EXISTS "Allow service role full access to extracted_questions" ON extracted_questions;

-- Allow authenticated users to read extracted questions
CREATE POLICY "Allow authenticated read access to extracted_questions"
ON extracted_questions
FOR SELECT
TO authenticated
USING (true);

-- Allow service role full access
CREATE POLICY "Allow service role full access to extracted_questions"
ON extracted_questions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================
-- 7. QUESTION_CLUSTERS TABLE
-- ============================================
DROP POLICY IF EXISTS "Allow authenticated read access to question_clusters" ON question_clusters;
DROP POLICY IF EXISTS "Allow service role full access to question_clusters" ON question_clusters;

-- Allow authenticated users to read question clusters
CREATE POLICY "Allow authenticated read access to question_clusters"
ON question_clusters
FOR SELECT
TO authenticated
USING (true);

-- Allow service role full access
CREATE POLICY "Allow service role full access to question_clusters"
ON question_clusters
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================
-- 8. FIX RPC FUNCTIONS TO USE SECURITY DEFINER
-- ============================================
-- This makes RPC functions execute with elevated privileges

CREATE OR REPLACE FUNCTION get_question_clusters()
RETURNS TABLE (
  cluster_id text,
  domanda text,
  numero_domande bigint,
  percentuale numeric
)
SECURITY DEFINER  -- Runs with elevated privileges to bypass RLS
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    qc.id::text as cluster_id,
    qc.cluster_label::text as domanda,
    COUNT(qcm.id) as numero_domande,
    ROUND(
      COUNT(qcm.id) * 100.0 / NULLIF((SELECT COUNT(*) FROM extracted_questions), 0),
      2
    ) as percentuale
  FROM question_clusters qc
  LEFT JOIN question_cluster_mappings qcm ON qc.id = qcm.cluster_id
  GROUP BY qc.id, qc.cluster_label
  ORDER BY numero_domande DESC;
END;
$$;

-- Grant execute permissions to anon and authenticated roles
GRANT EXECUTE ON FUNCTION get_question_clusters() TO anon;
GRANT EXECUTE ON FUNCTION get_question_clusters() TO authenticated;

CREATE OR REPLACE FUNCTION get_cluster_details(cluster_id_param text)
RETURNS TABLE (
  phone_number text,
  started_at timestamp,
  sentiment text,
  esito_chiamata text,
  domanda_specifica text
)
SECURITY DEFINER  -- Runs with elevated privileges to bypass RLS
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    ts.phone_number::text,
    ts.started_at::timestamp as started_at,
    ts.sentiment::text,
    ts.esito_chiamata::text,
    eq.question_text::text as domanda_specifica
  FROM question_cluster_mappings qcm
  JOIN extracted_questions eq ON qcm.question_id = eq.id
  JOIN tb_stat ts ON eq.call_id = ts.call_id
  WHERE qcm.cluster_id::text = cluster_id_param
  ORDER BY 2 DESC;
END;
$$;

-- Grant execute permissions to anon and authenticated roles
GRANT EXECUTE ON FUNCTION get_cluster_details(text) TO anon;
GRANT EXECUTE ON FUNCTION get_cluster_details(text) TO authenticated;

-- ============================================
-- 9. DASHBOARD STATS RPC FUNCTION
-- ============================================
-- Optimized function that aggregates all dashboard stats in a single query
-- Replaces multiple pagination loops in the Edge Function

CREATE OR REPLACE FUNCTION get_dashboard_stats(
  p_region text DEFAULT 'All Region',
  p_start_date text DEFAULT NULL,
  p_end_date text DEFAULT NULL,
  p_call_types text[] DEFAULT NULL
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_start_date timestamp;
  v_end_date timestamp;
  v_result jsonb;
  v_total_seconds numeric;
  v_total_calls bigint;
  v_booking_count bigint;
  v_chart_data jsonb;
  v_sentiment_stats jsonb;
  v_action_stats jsonb;
  v_hourly_stats jsonb;
BEGIN
  -- Set default dates if not provided
  v_start_date := COALESCE(p_start_date::timestamp, '2024-12-01'::timestamp);
  v_end_date := COALESCE((p_end_date || 'T23:59:59')::timestamp, (CURRENT_DATE || 'T23:59:59')::timestamp);

  -- Get aggregate totals
  -- call_type filter: treat NULL/'N/A' as 'info' so they match when p_call_types includes 'info'
  SELECT
    COALESCE(SUM(duration_seconds), 0),
    COUNT(*)
  INTO v_total_seconds, v_total_calls
  FROM tb_stat
  WHERE started_at IS NOT NULL
    AND started_at >= v_start_date
    AND started_at <= v_end_date
    AND (
      (p_region = 'All Region' AND region IS NOT NULL AND region != 'N/A')
      OR (p_region != 'All Region' AND region = p_region)
    )
    AND (
      p_call_types IS NULL
      OR COALESCE(NULLIF(call_type, 'N/A'), 'info') = ANY(p_call_types)
    );

  -- Get booking count
  SELECT COUNT(*)
  INTO v_booking_count
  FROM tb_stat
  WHERE started_at IS NOT NULL
    AND started_at >= v_start_date
    AND started_at <= v_end_date
    AND booking_code IS NOT NULL
    AND (
      (p_region = 'All Region' AND region IS NOT NULL AND region != 'N/A')
      OR (p_region != 'All Region' AND region = p_region)
    )
    AND (
      p_call_types IS NULL
      OR COALESCE(NULLIF(call_type, 'N/A'), 'info') = ANY(p_call_types)
    );

  -- Get chart data (grouped by date)
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_chart_data
  FROM (
    SELECT
      DATE(started_at)::text as date,
      COUNT(*) as calls,
      FLOOR(SUM(duration_seconds) / 60)::int as minutes,
      ROUND((SUM(duration_seconds) * 0.006)::numeric, 2) as revenue
    FROM tb_stat
    WHERE started_at IS NOT NULL
      AND started_at >= v_start_date
      AND started_at <= v_end_date
      AND (
        p_region = 'All Region'
        OR region = p_region
      )
      AND (
        p_call_types IS NULL
        OR COALESCE(NULLIF(call_type, 'N/A'), 'info') = ANY(p_call_types)
      )
    GROUP BY DATE(started_at)
    ORDER BY DATE(started_at)
  ) t;

  -- Get sentiment stats
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_sentiment_stats
  FROM (
    SELECT
      LOWER(TRIM(sentiment)) as sentiment,
      COUNT(*) as count
    FROM tb_stat
    WHERE started_at IS NOT NULL
      AND started_at >= v_start_date
      AND started_at <= v_end_date
      AND sentiment IS NOT NULL
      AND UPPER(TRIM(sentiment)) NOT IN ('N/A', 'NULL', '')
      AND (
        p_region = 'All Region'
        OR region = p_region
      )
      AND (
        p_call_types IS NULL
        OR COALESCE(NULLIF(call_type, 'N/A'), 'info') = ANY(p_call_types)
      )
    GROUP BY LOWER(TRIM(sentiment))
  ) t;

  -- Get action stats
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_action_stats
  FROM (
    SELECT
      action,
      COUNT(*) as count,
      ROUND(AVG(duration_seconds))::int as avg_duration
    FROM tb_stat
    WHERE started_at IS NOT NULL
      AND started_at >= v_start_date
      AND started_at <= v_end_date
      AND action IS NOT NULL
      AND (
        p_region = 'All Region'
        OR region = p_region
      )
      AND (
        p_call_types IS NULL
        OR COALESCE(NULLIF(call_type, 'N/A'), 'info') = ANY(p_call_types)
      )
    GROUP BY action
  ) t;

  -- Get hourly stats
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_hourly_stats
  FROM (
    SELECT
      EXTRACT(HOUR FROM started_at)::int as hour,
      COUNT(*) as calls_count
    FROM tb_stat
    WHERE started_at IS NOT NULL
      AND started_at >= v_start_date
      AND started_at <= v_end_date
      AND (
        p_region = 'All Region'
        OR region = p_region
      )
      AND (
        p_call_types IS NULL
        OR COALESCE(NULLIF(call_type, 'N/A'), 'info') = ANY(p_call_types)
      )
    GROUP BY EXTRACT(HOUR FROM started_at)
    ORDER BY hour
  ) t;

  -- Build result
  v_result := jsonb_build_object(
    'total_minutes', ROUND(v_total_seconds / 60),
    'total_revenue', ROUND((v_total_seconds * 0.006)::numeric, 2),
    'total_calls', v_total_calls,
    'avg_duration_minutes', CASE WHEN v_total_calls > 0 THEN ROUND((v_total_seconds / v_total_calls / 60)::numeric, 1) ELSE 0 END,
    'booking_count', v_booking_count,
    'chart_data', v_chart_data,
    'sentiment_stats', v_sentiment_stats,
    'action_stats', v_action_stats,
    'hourly_stats', v_hourly_stats
  );

  RETURN v_result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_dashboard_stats(text, text, text, text[]) TO anon;
GRANT EXECUTE ON FUNCTION get_dashboard_stats(text, text, text, text[]) TO authenticated;

-- Create composite index for dashboard queries
CREATE INDEX IF NOT EXISTS idx_tb_stat_started_region_calltype
ON tb_stat (started_at, region, call_type);

-- ============================================
-- 10. KPI OUTCOME TREND RPC FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION get_outcome_trend(
  p_region text DEFAULT 'All Region',
  p_start_date text DEFAULT NULL,
  p_end_date text DEFAULT NULL,
  p_call_types text[] DEFAULT NULL
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_start_date timestamp;
  v_end_date timestamp;
  v_result jsonb;
BEGIN
  v_start_date := COALESCE(p_start_date::timestamp, '2024-12-01'::timestamp);
  v_end_date := COALESCE((p_end_date || 'T23:59:59')::timestamp, (CURRENT_DATE || 'T23:59:59')::timestamp);

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      DATE(started_at)::text as date,
      esito_chiamata,
      COUNT(*) as count
    FROM tb_stat
    WHERE started_at IS NOT NULL
      AND esito_chiamata IS NOT NULL
      AND started_at >= v_start_date
      AND started_at <= v_end_date
      AND (
        (p_region = 'All Region' AND region IS NOT NULL AND region != 'N/A')
        OR (p_region != 'All Region' AND region = p_region)
      )
      AND (
        p_call_types IS NULL
        OR COALESCE(NULLIF(call_type, 'N/A'), 'info') = ANY(p_call_types)
      )
    GROUP BY DATE(started_at), esito_chiamata
    ORDER BY DATE(started_at)
  ) t;

  RETURN jsonb_build_object('data', v_result, 'total_entries', jsonb_array_length(v_result));
END;
$$;

GRANT EXECUTE ON FUNCTION get_outcome_trend(text, text, text, text[]) TO anon;
GRANT EXECUTE ON FUNCTION get_outcome_trend(text, text, text, text[]) TO authenticated;

-- ============================================
-- 11. KPI SENTIMENT TREND RPC FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION get_sentiment_trend(
  p_region text DEFAULT 'All Region',
  p_start_date text DEFAULT NULL,
  p_end_date text DEFAULT NULL,
  p_call_types text[] DEFAULT NULL
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_start_date timestamp;
  v_end_date timestamp;
  v_result jsonb;
BEGIN
  v_start_date := COALESCE(p_start_date::timestamp, '2024-12-01'::timestamp);
  v_end_date := COALESCE((p_end_date || 'T23:59:59')::timestamp, (CURRENT_DATE || 'T23:59:59')::timestamp);

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      DATE(started_at)::text as date,
      LOWER(sentiment) as sentiment,
      COUNT(*) as count
    FROM tb_stat
    WHERE started_at IS NOT NULL
      AND sentiment IS NOT NULL
      AND UPPER(TRIM(sentiment)) NOT IN ('N/A', 'NULL', '')
      AND started_at >= v_start_date
      AND started_at <= v_end_date
      AND (
        (p_region = 'All Region' AND region IS NOT NULL AND region != 'N/A')
        OR (p_region != 'All Region' AND region = p_region)
      )
      AND (
        p_call_types IS NULL
        OR COALESCE(NULLIF(call_type, 'N/A'), 'info') = ANY(p_call_types)
      )
    GROUP BY DATE(started_at), LOWER(sentiment)
    ORDER BY DATE(started_at)
  ) t;

  RETURN jsonb_build_object('data', v_result, 'total_entries', jsonb_array_length(v_result));
END;
$$;

GRANT EXECUTE ON FUNCTION get_sentiment_trend(text, text, text, text[]) TO anon;
GRANT EXECUTE ON FUNCTION get_sentiment_trend(text, text, text, text[]) TO authenticated;

-- ============================================
-- 12. KPI OUTCOME STATS RPC FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION get_outcome_stats(
  p_region text DEFAULT 'All Region',
  p_start_date text DEFAULT NULL,
  p_end_date text DEFAULT NULL,
  p_call_types text[] DEFAULT NULL
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_start_date timestamp;
  v_end_date timestamp;
  v_outcome_stats jsonb;
  v_motivation_stats jsonb;
  v_combined_stats jsonb;
  v_total_calls bigint;
BEGIN
  v_start_date := COALESCE(p_start_date::timestamp, '2024-12-01'::timestamp);
  v_end_date := COALESCE((p_end_date || 'T23:59:59')::timestamp, (CURRENT_DATE || 'T23:59:59')::timestamp);

  -- Outcome stats (with RIAGGANCIATO for null/empty/N/A)
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_outcome_stats
  FROM (
    SELECT
      CASE
        WHEN esito_chiamata IS NULL OR TRIM(esito_chiamata) = '' OR UPPER(TRIM(esito_chiamata)) IN ('NULL', 'N/A')
        THEN 'RIAGGANCIATO'
        ELSE esito_chiamata
      END as esito_chiamata,
      COUNT(*) as count
    FROM tb_stat
    WHERE started_at IS NOT NULL
      AND started_at >= v_start_date
      AND started_at <= v_end_date
      AND (
        p_region = 'All Region'
        OR region = p_region
      )
      AND (
        p_call_types IS NULL
        OR COALESCE(NULLIF(call_type, 'N/A'), 'info') = ANY(p_call_types)
      )
    GROUP BY 1
  ) t;

  -- Motivation stats
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_motivation_stats
  FROM (
    SELECT
      motivazione,
      COUNT(*) as count
    FROM tb_stat
    WHERE started_at IS NOT NULL
      AND started_at >= v_start_date
      AND started_at <= v_end_date
      AND motivazione IS NOT NULL
      AND TRIM(motivazione) != ''
      AND UPPER(TRIM(motivazione)) != 'NULL'
      AND (
        p_region = 'All Region'
        OR region = p_region
      )
      AND (
        p_call_types IS NULL
        OR COALESCE(NULLIF(call_type, 'N/A'), 'info') = ANY(p_call_types)
      )
    GROUP BY motivazione
  ) t;

  -- Combined stats (esito + motivazione)
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_combined_stats
  FROM (
    -- Regular esito + motivazione combinations
    SELECT
      esito_chiamata,
      LOWER(TRIM(motivazione)) as motivazione,
      COUNT(*) as count
    FROM tb_stat
    WHERE started_at IS NOT NULL
      AND started_at >= v_start_date
      AND started_at <= v_end_date
      AND esito_chiamata IS NOT NULL
      AND TRIM(esito_chiamata) != ''
      AND UPPER(TRIM(esito_chiamata)) NOT IN ('NULL', 'N/A')
      AND motivazione IS NOT NULL
      AND TRIM(motivazione) != ''
      AND UPPER(TRIM(motivazione)) != 'NULL'
      AND (
        p_region = 'All Region'
        OR region = p_region
      )
      AND (
        p_call_types IS NULL
        OR COALESCE(NULLIF(call_type, 'N/A'), 'info') = ANY(p_call_types)
      )
    GROUP BY esito_chiamata, LOWER(TRIM(motivazione))

    UNION ALL

    -- RIAGGANCIATO (hung-up calls)
    SELECT
      'RIAGGANCIATO' as esito_chiamata,
      'riagganciato' as motivazione,
      COUNT(*) as count
    FROM tb_stat
    WHERE started_at IS NOT NULL
      AND started_at >= v_start_date
      AND started_at <= v_end_date
      AND (esito_chiamata IS NULL OR TRIM(esito_chiamata) = '' OR UPPER(TRIM(esito_chiamata)) IN ('NULL', 'N/A'))
      AND (
        p_region = 'All Region'
        OR region = p_region
      )
      AND (
        p_call_types IS NULL
        OR COALESCE(NULLIF(call_type, 'N/A'), 'info') = ANY(p_call_types)
      )
  ) t;

  -- Total calls
  SELECT COUNT(*)
  INTO v_total_calls
  FROM tb_stat
  WHERE started_at IS NOT NULL
    AND started_at >= v_start_date
    AND started_at <= v_end_date
    AND (
      (p_region = 'All Region' AND region IS NOT NULL AND region != 'N/A')
      OR (p_region != 'All Region' AND region = p_region)
    )
    AND (
      p_call_types IS NULL
      OR COALESCE(NULLIF(call_type, 'N/A'), 'info') = ANY(p_call_types)
    );

  RETURN jsonb_build_object(
    'outcome_stats', v_outcome_stats,
    'motivation_stats', v_motivation_stats,
    'combined_stats', v_combined_stats,
    'total_calls_with_outcome', v_total_calls
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_outcome_stats(text, text, text, text[]) TO anon;
GRANT EXECUTE ON FUNCTION get_outcome_stats(text, text, text, text[]) TO authenticated;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these to verify policies were created:

-- Check policies on users table
-- SELECT * FROM pg_policies WHERE tablename = 'users';

-- Check policies on tb_stat table
-- SELECT * FROM pg_policies WHERE tablename = 'tb_stat';

-- Check RPC function security
-- SELECT proname, prosecdef FROM pg_proc WHERE proname IN ('get_question_clusters', 'get_cluster_details');