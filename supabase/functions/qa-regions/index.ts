/**
 * Q&A Regions Edge Function
 * Returns distinct regions from qa_entries table
 */ import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from './functions/_shared/supabase.ts';
import { getCurrentUser } from './functions/_shared/auth.ts';
import { corsHeaders, handleCors } from './functions/_shared/cors.ts';
serve(async (req)=>{
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  try {
    // Validate user authentication (uses custom Bearer token, not JWT)
    const currentUser = await getCurrentUser(req);
    console.log(`📋 Fetching Q&A regions (by ${currentUser.email})`);
    const supabase = createSupabaseClient();
    // Get distinct regions from qa_entries table
    const { data, error } = await supabase.from('qa_entries').select('region').not('region', 'is', null).order('region', {
      ascending: true
    });
    if (error) throw error;
    // Get unique regions (client-side DISTINCT)
    const uniqueRegions = [
      ...new Set(data?.map((row)=>row.region) || [])
    ];
    // Build regions list with "All Region" first
    const regions = [
      {
        value: 'All Region',
        label: 'All Region'
      }
    ];
    uniqueRegions.forEach((region)=>{
      if (region) {
        regions.push({
          value: region,
          label: region
        });
      }
    });
    console.log(`✅ Found ${uniqueRegions.length} distinct regions in Q&A entries`);
    return new Response(JSON.stringify(regions), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('❌ Error fetching Q&A regions:', error);
    return new Response(JSON.stringify({
      detail: error.message || 'Errore nel caricamento delle regioni'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
