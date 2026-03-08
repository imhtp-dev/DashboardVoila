/**
 * Dashboard Call Summary Edge Function
 * Returns call summary and details for a specific call
 */ import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
serve(async (req)=>{
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  try {
    // Extract call_id from query parameters (not path)
    const url = new URL(req.url);
    const callId = url.searchParams.get('call_id');
    if (!callId) {
      return new Response(JSON.stringify({
        detail: 'Call ID mancante'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log(`📞 Getting summary for call: ${callId}`);
    const supabase = createSupabaseClient();
    // Query tb_stat for call data
    const { data: callData, error } = await supabase.from('tb_stat').select('call_id, started_at, ended_at, patient_intent, esito_chiamata, motivazione, summary, transcript').eq('call_id', callId).single();
    if (error || !callData) {
      return new Response(JSON.stringify({
        detail: 'Chiamata non trovata'
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Return call data with summary and transcript
    return new Response(JSON.stringify({
      success: true,
      call_id: callId,
      summary: callData.summary || 'Nessun summary disponibile',
      transcript: callData.transcript || 'Nessun transcript disponibile',
      started_at: callData.started_at,
      ended_at: callData.ended_at,
      patient_intent: callData.patient_intent,
      esito_chiamata: callData.esito_chiamata,
      motivazione: callData.motivazione,
      has_analysis: !!callData.patient_intent,
      has_transcript: !!callData.transcript
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('❌ Error getting call summary:', error);
    return new Response(JSON.stringify({
      detail: `Errore nel recupero del summary: ${error.message || 'Unknown error'}`
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
