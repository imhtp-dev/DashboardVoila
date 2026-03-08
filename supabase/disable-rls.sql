-- ============================================
-- DISABLE RLS ON ALL TABLES
-- ============================================
-- Run this SQL in your Supabase SQL Editor to disable RLS

-- Disable RLS on all tables
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE tb_stat DISABLE ROW LEVEL SECURITY;
ALTER TABLE qa_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE question_cluster_mappings DISABLE ROW LEVEL SECURITY;
ALTER TABLE extracted_questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE question_clusters DISABLE ROW LEVEL SECURITY;

-- Verification: Check RLS status (all should show relrowsecurity = false)
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
