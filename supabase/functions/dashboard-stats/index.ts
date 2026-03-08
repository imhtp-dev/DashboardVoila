/**
 * Dashboard Stats Edge Function
 * Returns dashboard statistics (total calls, revenue, minutes, chart data)
 * Optimized: Uses Postgres RPC function for server-side aggregation
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getCurrentUser } from '../_shared/auth.ts';

serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Authenticate user
    const currentUser = await getCurrentUser(req);

    // Parse query parameters
    const url = new URL(req.url);
    let region = url.searchParams.get('region') || 'All Region';
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');

    // call_type filter: 'info', 'booking', 'booking_incomplete' or comma-separated list
    const callTypeParam = url.searchParams.get('call_type');
    const callTypes = callTypeParam ? callTypeParam.split(',').map(t => t.trim()) : null;

    // Enforce region-based access control
    const userRegion = currentUser.region;
    if (userRegion && userRegion !== 'master') {
      region = userRegion;
      console.log(`📊 Loading dashboard data for regional user (forced to ${userRegion})`);
    } else {
      console.log(`📊 Loading dashboard data for master user (region: ${region})`);
    }

    if (startDate && endDate) {
      console.log(`📅 Date filter: ${startDate} to ${endDate}`);
    }
    if (callTypes && callTypes.length > 0) {
      console.log(`📞 Call type filter: ${callTypes.join(', ')}`);
    }

    const supabase = createSupabaseClient();

    // Call the optimized Postgres RPC function
    const { data, error } = await supabase.rpc('get_dashboard_stats', {
      p_region: region,
      p_start_date: startDate || null,
      p_end_date: endDate || null,
      p_call_types: callTypes
    });

    if (error) {
      console.error('❌ RPC error:', error);
      throw error;
    }

    // Fill in zero-days for chart_data (dates with no calls)
    const chartDataMap = new Map(
      (data.chart_data || []).map((d: { date: string }) => [d.date, d])
    );

    const filledChartData = [];
    const start = new Date(startDate || '2024-12-01');
    const end = new Date(endDate || new Date().toISOString().substring(0, 10));

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().substring(0, 10);
      filledChartData.push(
        chartDataMap.get(dateStr) || { date: dateStr, calls: 0, minutes: 0, revenue: 0 }
      );
    }

    console.log(`✅ Dashboard data loaded: ${data.total_calls} calls, ${data.total_minutes} minutes, €${data.total_revenue}`);

    return new Response(JSON.stringify({
      total_minutes: data.total_minutes,
      total_revenue: data.total_revenue,
      total_calls: data.total_calls,
      avg_duration_minutes: data.avg_duration_minutes,
      booking_count: data.booking_count,
      chart_data: filledChartData,
      sentiment_stats: data.sentiment_stats,
      action_stats: data.action_stats,
      hourly_stats: data.hourly_stats
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('❌ Error loading dashboard data:', error);
    // Return empty data on error
    return new Response(JSON.stringify({
      total_minutes: 0,
      total_revenue: 0.0,
      total_calls: 0,
      chart_data: [],
      avg_duration_minutes: 0.0,
      sentiment_stats: [],
      action_stats: [],
      hourly_stats: [],
      booking_count: 0
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
