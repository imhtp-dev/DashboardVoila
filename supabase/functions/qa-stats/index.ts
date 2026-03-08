/**
 * Q&A Stats Edge Function
 * Replaces: GET /api/qa/stats/{region} from info_agent
 */ import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { getCurrentUser } from '../_shared/auth.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
serve(async (req)=>{
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  try {
    const currentUser = await getCurrentUser(req);
    const url = new URL(req.url);
    const region = url.pathname.split('/').pop();
    console.log(`📊 Getting Q&A stats for region: ${region} (by ${currentUser.email})`);
    if (!region || region === 'qa-stats') {
      throw new Error('Region is required');
    }
    // Check regional access
    if (currentUser.region !== 'master' && currentUser.region !== region) {
      throw new Error('Non autorizzato ad accedere a questa regione');
    }
    const supabase = createSupabaseClient();
    // Total Q&A count (include Nazionale - case-sensitive)
    const { count: totalQa, error: totalError } = await supabase.from('qa_entries').select('*', {
      count: 'exact',
      head: true
    }).or(`region.eq.${region},region.eq.Nazionale`);
    if (totalError) throw totalError;
    // Recent Q&A (last 30 days, include Nazionale - case-sensitive)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { count: recentQa, error: recentError } = await supabase.from('qa_entries').select('*', {
      count: 'exact',
      head: true
    }).or(`region.eq.${region},region.eq.Nazionale`).gte('created_at', thirtyDaysAgo.toISOString());
    if (recentError) throw recentError;
    // Updated Q&A (last 30 days, include Nazionale - case-sensitive)
    const { count: updatedQa, error: updatedError } = await supabase.from('qa_entries').select('*', {
      count: 'exact',
      head: true
    }).or(`region.eq.${region},region.eq.Nazionale`).gte('updated_at', thirtyDaysAgo.toISOString()).neq('updated_at', 'created_at') // Only count actual updates
    ;
    if (updatedError) throw updatedError;
    console.log(`✅ Stats: ${totalQa} total, ${recentQa} recent, ${updatedQa} updated`);
    return new Response(JSON.stringify({
      region,
      total_qa: totalQa || 0,
      recent_qa: recentQa || 0,
      updated_qa: updatedQa || 0
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('❌ Error getting Q&A stats:', error);
    return new Response(JSON.stringify({
      detail: error.message || 'Errore nel caricamento delle statistiche'
    }), {
      status: error.message.includes('autorizzato') ? 403 : 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
