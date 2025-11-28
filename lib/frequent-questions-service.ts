/**
 * Frequent Questions Service
 * Handles Supabase RPC queries for question clusters analysis
 */

import { supabase } from './supabase-client';
import type { QuestionCluster, ClusterDetail } from '@/types';

/**
 * Get all question clusters with statistics
 *
 * Calls Supabase RPC function that executes:
 * SELECT qc.id as cluster_id, qc.cluster_label as domanda,
 *        COUNT(qcm.id) as numero_domande,
 *        ROUND(COUNT(qcm.id) * 100.0 / (SELECT COUNT(*) FROM extracted_questions), 2) as percentuale
 * FROM question_clusters qc
 * LEFT JOIN question_cluster_mappings qcm ON qc.id = qcm.cluster_id
 * GROUP BY qc.id, qc.cluster_label
 * ORDER BY numero_domande DESC
 */
export async function getQuestionClusters(): Promise<QuestionCluster[]> {
  try {
    console.log('Fetching question clusters...');

    const { data, error } = await supabase.rpc('get_question_clusters');

    console.log('Supabase RPC response:', { data, error });

    if (error) {
      console.error('Supabase error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw new Error(`Failed to fetch question clusters: ${error.message}`);
    }

    return data || [];
  } catch (err) {
    console.error('Unexpected error in getQuestionClusters:', err);
    throw err;
  }
}

/**
 * Get detailed questions for a specific cluster
 *
 * Calls Supabase RPC function that executes:
 * SELECT DISTINCT ts.phone_number, ts.started_at, ts.sentiment, ts.esito_chiamata,
 *        eq.question_text as domanda_specifica
 * FROM question_cluster_mappings qcm
 * JOIN extracted_questions eq ON qcm.question_id = eq.id
 * JOIN tb_stat ts ON eq.call_id = ts.call_id
 * WHERE qcm.cluster_id = cluster_id_param
 * ORDER BY ts.started_at DESC
 *
 * @param clusterId - UUID of the cluster to fetch details for
 */
export async function getClusterDetails(clusterId: string): Promise<ClusterDetail[]> {
  try {
    console.log('Fetching cluster details for ID:', clusterId);

    const { data, error } = await supabase.rpc('get_cluster_details', {
      cluster_id_param: clusterId
    });

    console.log('Supabase RPC response:', { data, error });

    if (error) {
      console.error('Supabase error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw new Error(`Failed to fetch cluster details: ${error.message}`);
    }

    return data || [];
  } catch (err) {
    console.error('Unexpected error in getClusterDetails:', err);
    throw err;
  }
}
