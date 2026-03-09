/**
 * Dashboard Calls Edge Function
 * Returns paginated list of calls
 */ import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getCurrentUser } from '../_shared/auth.ts';
serve(async (req)=>{
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  try {
    // Authenticate user
    const currentUser = await getCurrentUser(req);
    // Parse query parameters
    const url = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '100'), 1), 1000);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0'), 0);
    let region = url.searchParams.get('region') || 'All Region';
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');
    const searchQuery = url.searchParams.get('search_query');
    // Column filters (comma-separated values for multi-select)
    const sentimentFilter = url.searchParams.get('sentiment')?.split(',').filter(Boolean) || [];
    const esitoFilter = url.searchParams.get('esito')?.split(',').filter(Boolean) || [];
    const motivazioneFilter = url.searchParams.get('motivazione')?.split(',').filter(Boolean) || [];
    const callTypeParam = url.searchParams.get('call_type');
    const callTypes = callTypeParam ? callTypeParam.split(',').map(t => t.trim()) : null;
    // Enforce region-based access control
    const userRegion = currentUser.region;
    if (userRegion && userRegion !== 'master') {
      // Regional users can ONLY see their assigned region
      region = userRegion;
      console.log(`📋 Loading calls for regional user (forced to ${userRegion})`);
    } else {
      console.log(`📋 Loading calls for master user (region: ${region})`);
    }
    console.log(`📋 Loading calls (limit: ${limit}, offset: ${offset}, region: ${region}, search: ${searchQuery || 'none'})`);
    const supabase = createSupabaseClient();
    // Build count query
    let countQuery = supabase.from('tb_stat').select('*', {
      count: 'exact',
      head: true
    }).not('started_at', 'is', null);
    if (region && region !== 'All Region') {
      countQuery = countQuery.eq('region', region);
    } else {
      // For "All Region", exclude records with NULL or N/A region to ensure consistency
      countQuery = countQuery.not('region', 'is', null).neq('region', 'N/A');
    }
    if (startDate && endDate) {
      countQuery = countQuery.gte('started_at', `${startDate}T00:00:00`).lte('started_at', `${endDate}T23:59:59`);
    }
    if (searchQuery) {
      const trimmed = searchQuery.trim();
      // If starts with +39, search by phone number
      if (trimmed.startsWith('+39')) {
        countQuery = countQuery.ilike('phone_number', `%${trimmed}%`);
      } else {
        // Otherwise, search by id_stat (exact match)
        const idValue = parseInt(trimmed);
        if (!isNaN(idValue)) {
          countQuery = countQuery.eq('id_stat', idValue);
        }
      }
    }
    // Apply column filters to count query
    if (sentimentFilter.length > 0) {
      countQuery = countQuery.in('sentiment', sentimentFilter);
    }
    if (esitoFilter.length > 0) {
      countQuery = countQuery.in('esito_chiamata', esitoFilter);
    }
    if (motivazioneFilter.length > 0) {
      countQuery = countQuery.in('motivazione', motivazioneFilter);
    }
    // Call type filter (using raw SQL via .or() to handle COALESCE for NULL → 'info')
    if (callTypes && callTypes.length > 0) {
      // Build filter: COALESCE(NULLIF(call_type, 'N/A'), 'info') in callTypes
      const orConditions = callTypes.map(ct => `call_type.eq.${ct}`).join(',');
      // If 'info' is in the filter, also include NULL and N/A call_type rows
      if (callTypes.includes('info')) {
        countQuery = countQuery.or(`${orConditions},call_type.is.null,call_type.eq.N/A,call_type.eq.`);
      } else {
        countQuery = countQuery.in('call_type', callTypes);
      }
    }
    const { count: totalCalls, error: countError } = await countQuery;
    if (countError) throw countError;
    // Build data query
    let dataQuery = supabase.from('tb_stat').select('id_stat, started_at, call_id, interaction_id, phone_number, duration_seconds, action, sentiment, motivazione, esito_chiamata').not('started_at', 'is', null);
    if (region && region !== 'All Region') {
      dataQuery = dataQuery.eq('region', region);
    } else {
      // For "All Region", exclude records with NULL or N/A region to ensure consistency
      dataQuery = dataQuery.not('region', 'is', null).neq('region', 'N/A');
    }
    if (startDate && endDate) {
      dataQuery = dataQuery.gte('started_at', `${startDate}T00:00:00`).lte('started_at', `${endDate}T23:59:59`);
    }
    if (searchQuery) {
      const trimmed = searchQuery.trim();
      // If starts with +39, search by phone number
      if (trimmed.startsWith('+39')) {
        dataQuery = dataQuery.ilike('phone_number', `%${trimmed}%`);
      } else {
        // Otherwise, search by id_stat (exact match)
        const idValue = parseInt(trimmed);
        if (!isNaN(idValue)) {
          dataQuery = dataQuery.eq('id_stat', idValue);
        }
      }
    }
    // Apply column filters to data query
    if (sentimentFilter.length > 0) {
      dataQuery = dataQuery.in('sentiment', sentimentFilter);
    }
    if (esitoFilter.length > 0) {
      dataQuery = dataQuery.in('esito_chiamata', esitoFilter);
    }
    if (motivazioneFilter.length > 0) {
      dataQuery = dataQuery.in('motivazione', motivazioneFilter);
    }
    // Call type filter (same logic as count query)
    if (callTypes && callTypes.length > 0) {
      const orConditions = callTypes.map(ct => `call_type.eq.${ct}`).join(',');
      if (callTypes.includes('info')) {
        dataQuery = dataQuery.or(`${orConditions},call_type.is.null,call_type.eq.N/A,call_type.eq.`);
      } else {
        dataQuery = dataQuery.in('call_type', callTypes);
      }
    }
    dataQuery = dataQuery.order('started_at', {
      ascending: false
    }).range(offset, offset + limit - 1);
    const { data: results, error: dataError } = await dataQuery;
    if (dataError) throw dataError;
    // Format calls
    const calls = results?.map((row)=>({
        id: row.id_stat,
        started_at: row.started_at,
        call_id: row.call_id,
        interaction_id: row.interaction_id,
        phone_number: row.phone_number,
        duration_seconds: row.duration_seconds || 0,
        action: row.action || 'N/A',
        sentiment: row.sentiment || 'N/A',
        motivazione: row.motivazione || 'N/A',
        esito_chiamata: row.esito_chiamata || 'N/A'
      })) || [];
    // Calculate pagination info
    const totalPages = Math.ceil((totalCalls || 0) / limit);
    const currentPage = Math.floor(offset / limit) + 1;
    const hasNext = offset + limit < (totalCalls || 0);
    const hasPrevious = offset > 0;
    console.log(`✅ Loaded ${calls.length} calls (page ${currentPage}/${totalPages})`);
    return new Response(JSON.stringify({
      calls,
      pagination: {
        total_calls: totalCalls || 0,
        total_pages: totalPages,
        current_page: currentPage,
        has_next: hasNext,
        has_previous: hasPrevious,
        limit,
        offset
      }
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('❌ Error loading calls:', error);
    // Parse query parameters for fallback
    const url = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '100'), 1), 1000);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0'), 0);
    return new Response(JSON.stringify({
      calls: [],
      pagination: {
        total_calls: 0,
        total_pages: 0,
        current_page: 1,
        has_next: false,
        has_previous: false,
        limit,
        offset
      }
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
