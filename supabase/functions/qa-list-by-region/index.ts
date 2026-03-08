/**
 * Q&A List By Region Edge Function
 * Replaces: GET /api/qa/region/{region} from info_agent
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
    console.log(`📚 Listing Q&A for region: ${region} (by ${currentUser.email})`);
    if (!region || region === 'qa-list-by-region') {
      throw new Error('Region is required');
    }
    // Check regional access
    if (currentUser.region !== 'master' && currentUser.region !== region) {
      throw new Error('Non autorizzato ad accedere a questa regione');
    }
    const supabase = createSupabaseClient();
    // Include Nazionale Q&As for all regions (case-sensitive: Nazionale with capital N)
    console.log(`🔍 Query: region.eq.${region},region.eq.Nazionale`);
    const { data: qaList, error } = await supabase.from('qa_entries').select('*').or(`region.eq.${region},region.eq.Nazionale`).order('created_at', {
      ascending: false
    });
    if (error) throw error;
    console.log(`✅ Found ${qaList?.length || 0} Q&A entries`);
    return new Response(JSON.stringify(qaList || []), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('❌ Error listing Q&A:', error);
    return new Response(JSON.stringify({
      detail: error.message || 'Errore nel caricamento delle Q&A'
    }), {
      status: error.message.includes('autorizzato') ? 403 : 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
