/**
 * Dashboard Voice Agents Edge Function
 * Returns list of voice agents
 */ import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
serve(async (req)=>{
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  try {
    console.log('🎤 Getting voice agents');
    const supabase = createSupabaseClient();
    // Get voice agents where public = true
    const { data, error } = await supabase.from('tb_voice_agent').select('id_voice_agent, regione, assistant_id').eq('public', true).order('regione', {
      ascending: true
    });
    if (error) throw error;
    const voiceAgents = data || [];
    console.log(`✅ Found ${voiceAgents.length} voice agents`);
    return new Response(JSON.stringify(voiceAgents), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('❌ Error fetching voice agents:', error);
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
