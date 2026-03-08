/**
 * Dashboard Outcome Trend Edge Function
 * Returns esito_chiamata trend data over time for line chart
 * Optimized: Uses Postgres RPC function for server-side aggregation
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getCurrentUser } from '../_shared/auth.ts';

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const currentUser = await getCurrentUser(req);
    const url = new URL(req.url);
    let region = url.searchParams.get('region') || 'All Region';
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');

    // call_type filter: 'info', 'booking', 'booking_incomplete' or comma-separated list
    const callTypeParam = url.searchParams.get('call_type');
    const callTypes = callTypeParam ? callTypeParam.split(',').map(t => t.trim()) : null;

    // Enforce regional access
    if (currentUser.region && currentUser.region !== 'master') {
      region = currentUser.region;
    }

    const supabase = createSupabaseClient();

    // Call optimized RPC function
    const { data, error } = await supabase.rpc('get_outcome_trend', {
      p_region: region,
      p_start_date: startDate || null,
      p_end_date: endDate || null,
      p_call_types: callTypes
    });

    if (error) {
      console.error('❌ RPC error:', error);
      throw error;
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('❌ Error loading outcome trend:', error);
    return new Response(JSON.stringify({
      data: [],
      total_entries: 0
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
