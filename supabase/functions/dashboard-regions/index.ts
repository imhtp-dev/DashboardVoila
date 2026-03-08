/**
 * Dashboard Regions Edge Function
 * Returns list of available regions
 */ import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
serve(async (req)=>{
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  try {
    const supabase = createSupabaseClient();
    // Get distinct regions from tb_stat (call data table)
    const { data, error } = await supabase.from('tb_stat').select('region');
    if (error) throw error;
    // Extract unique regions and format
    const uniqueRegions = Array.from(new Set(data?.map((item)=>item.region).filter((r)=>r) || []));
    // Add "All Region" option for master users
    const regions = [
      {
        value: 'All Region',
        label: 'All Region'
      },
      ...uniqueRegions.map((region)=>({
          value: region,
          label: region
        }))
    ];
    return new Response(JSON.stringify(regions), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error getting regions:', error);
    return new Response(JSON.stringify({
      detail: error.message || 'Error loading regions'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
