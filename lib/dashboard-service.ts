/**
 * Dashboard Service - Direct Supabase Queries
 * Replaces info_agent API calls with direct database queries
 *
 * This file translates the SQL queries from info_agent/api/dashboard.py
 * into Supabase JS SDK queries
 */

import { supabase } from './supabase-client'
import type { DashboardStats, CallListResponse, CallItem, Region, AdditionalStats, CallOutcomeStats, TrendResponse } from './api-client'

// ==================== Helper Functions ====================

/**
 * Build date filter for queries
 */
function buildDateFilter(startDate?: string, endDate?: string) {
  const filters: any = {}

  if (startDate) {
    filters.gte = startDate
  }

  if (endDate) {
    filters.lte = endDate
  }

  return filters
}

// ==================== Dashboard Queries ====================

/**
 * Get Booking Count
 * Counts rows in tb_stat where booking_code is not null
 * Uses raw fetch to Supabase REST API to avoid type issues
 */
export async function getBookingCount(params?: {
  region?: string
  start_date?: string
  end_date?: string
}): Promise<number> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

    // Build query parameters for PostgREST
    let url = `${supabaseUrl}/rest/v1/tb_stat?select=booking_code&booking_code=not.is.null`

    // Apply region filter (only if specific region selected)
    if (params?.region && params.region !== 'All Region') {
      url += `&region=eq.${encodeURIComponent(params.region)}`
    }

    // Apply date filters only if provided (booking_code query doesn't need default dates)
    if (params?.start_date && params?.end_date) {
      url += `&started_at=gte.${params.start_date}T00:00:00`
      url += `&started_at=lte.${params.end_date}T23:59:59`
    }

    console.log('Booking count URL:', url)

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'count=exact'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Booking count API error:', response.status, errorText)
      throw new Error(errorText)
    }

    // Get count from Content-Range header
    const contentRange = response.headers.get('content-range')
    console.log('Content-Range header:', contentRange)

    if (contentRange) {
      // Format: "0-9/100" where 100 is total count
      const match = contentRange.match(/\/(\d+)/)
      if (match) {
        const count = parseInt(match[1], 10)
        console.log('Booking count result:', count)
        return count
      }
    }

    // Fallback: count the returned data
    const data = await response.json()
    console.log('Booking data:', data)
    return Array.isArray(data) ? data.length : 0
  } catch (error) {
    console.error('Error loading booking count:', error)
    return 0
  }
}

/**
 * Get Dashboard Statistics
 *
 * Original SQL from dashboard.py:89-96:
 * SELECT COUNT(*) as total_calls,
 *        COALESCE(SUM(duration_seconds), 0) as total_duration_seconds,
 *        COALESCE(AVG(duration_seconds), 0) as avg_duration_seconds
 * FROM tb_stat
 * WHERE started_at IS NOT NULL
 *   AND region = $1
 *   AND DATE(started_at) >= $2 AND DATE(started_at) <= $3
 */
export async function getDashboardStats(params?: {
  region?: string
  start_date?: string
  end_date?: string
  call_type?: string | string[]  // 'info' | 'booking' | 'booking_incomplete' or array
}): Promise<DashboardStats> {
  try {
    // Build query
    let query = supabase
      .from('tb_stat')
      .select('duration_seconds, started_at', { count: 'exact' })
      .not('started_at', 'is', null)

    // Apply region filter
    if (params?.region && params.region !== 'All Region') {
      query = query.eq('region', params.region)
    } else {
      // For "All Region", exclude records with NULL or N/A region to ensure consistency
      query = query.not('region', 'is', null).neq('region', 'N/A')
    }

    // Apply call_type filter
    if (params?.call_type) {
      if (Array.isArray(params.call_type)) {
        // Multiple call_types (e.g., ['booking', 'booking_incomplete'])
        query = query.in('call_type', params.call_type)
      } else {
        // Single call_type (e.g., 'info')
        query = query.eq('call_type', params.call_type)
      }
      // Exclude N/A call_type records
      query = query.neq('call_type', 'N/A')
    }

    // Apply date filters
    if (params?.start_date && params?.end_date) {
      // Use started_at::date for date comparison
      query = query
        .gte('started_at', `${params.start_date}T00:00:00`)
        .lte('started_at', `${params.end_date}T23:59:59`)
    }

    const { data, count, error } = await query

    if (error) throw error

    // Calculate aggregations (similar to SQL COALESCE and SUM/AVG)
    const total_calls = count || 0
    const total_duration_seconds = data?.reduce((sum, row) => sum + (row.duration_seconds || 0), 0) || 0
    const avg_duration_seconds = total_calls > 0 ? total_duration_seconds / total_calls : 0

    // Convert to minutes
    const total_minutes = Math.floor(total_duration_seconds / 60)
    const avg_duration_minutes = Number((avg_duration_seconds / 60).toFixed(1))

    // Calculate revenue (0.006 euro per second)
    const total_revenue = Number((total_duration_seconds * 0.006).toFixed(2))

    // Get chart data (last 7 days or date range)
    const chartData = await getChartData(params)

    return {
      total_minutes,
      total_revenue,
      total_calls,
      chart_data: chartData,
      avg_duration_minutes,
    }
  } catch (error) {
    console.error('Error loading dashboard stats:', error)
    return {
      total_minutes: 0,
      total_revenue: 0,
      total_calls: 0,
      chart_data: [],
      avg_duration_minutes: 0,
    }
  }
}

/**
 * Get Chart Data for Dashboard
 *
 * Original SQL from dashboard.py:126-135:
 * SELECT DATE(started_at) as call_date,
 *        COUNT(*) as daily_calls,
 *        COALESCE(SUM(duration_seconds), 0) as daily_duration_seconds
 * FROM tb_stat
 * WHERE ...
 * GROUP BY DATE(started_at)
 * ORDER BY call_date ASC
 */
async function getChartData(params?: {
  region?: string
  start_date?: string
  end_date?: string
}): Promise<Array<{ date: string; calls: number; minutes: number; revenue: number }>> {
  try {
    // Determine date range
    let startDate: Date
    let endDate: Date

    if (params?.start_date && params?.end_date) {
      startDate = new Date(params.start_date)
      endDate = new Date(params.end_date)
    } else {
      // Last 7 days
      endDate = new Date()
      startDate = new Date()
      startDate.setDate(startDate.getDate() - 6)
    }

    // Build query
    let query = supabase
      .from('tb_stat')
      .select('started_at, duration_seconds')
      .not('started_at', 'is', null)
      .gte('started_at', startDate.toISOString())
      .lte('started_at', endDate.toISOString())

    if (params?.region && params.region !== 'All Region') {
      query = query.eq('region', params.region)
    } else {
      // For "All Region", exclude records with NULL or N/A region to ensure consistency
      query = query.not('region', 'is', null).neq('region', 'N/A')
    }

    const { data, error } = await query

    if (error) throw error

    // Group by date (client-side aggregation since Supabase doesn't support GROUP BY in JS SDK)
    const groupedByDate: Record<string, { calls: number; duration_seconds: number }> = {}

    data?.forEach((row) => {
      const date = new Date(row.started_at!).toISOString().split('T')[0]
      if (!groupedByDate[date]) {
        groupedByDate[date] = { calls: 0, duration_seconds: 0 }
      }
      groupedByDate[date].calls += 1
      groupedByDate[date].duration_seconds += row.duration_seconds || 0
    })

    // Generate all dates in range with data
    const chartData: Array<{ date: string; calls: number; minutes: number; revenue: number }> = []
    const current = new Date(startDate)

    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0]
      const dayData = groupedByDate[dateStr] || { calls: 0, duration_seconds: 0 }

      chartData.push({
        date: dateStr,
        calls: dayData.calls,
        minutes: Math.floor(dayData.duration_seconds / 60),
        revenue: Number((dayData.duration_seconds * 0.006).toFixed(2)),
      })

      current.setDate(current.getDate() + 1)
    }

    return chartData
  } catch (error) {
    console.error('Error loading chart data:', error)
    return []
  }
}

/**
 * Get Paginated Call List
 *
 * Original SQL from dashboard.py:282-297:
 * SELECT id_stat as id, started_at, call_id, interaction_id, phone_number,
 *        duration_seconds, action, sentiment, motivazione, esito_chiamata
 * FROM tb_stat
 * WHERE started_at IS NOT NULL AND region = $1
 *   AND DATE(started_at) >= $2 AND DATE(started_at) <= $3
 * ORDER BY started_at DESC
 * LIMIT $4 OFFSET $5
 */
export async function getCalls(params?: {
  limit?: number
  offset?: number
  region?: string
  start_date?: string
  end_date?: string
}): Promise<CallListResponse> {
  try {
    const limit = params?.limit || 100
    const offset = params?.offset || 0

    // Build query for calls
    let query = supabase
      .from('tb_stat')
      .select(
        'id_stat, started_at, call_id, interaction_id, phone_number, duration_seconds, action, sentiment, motivazione, esito_chiamata',
        { count: 'exact' }
      )
      .not('started_at', 'is', null)
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply region filter
    if (params?.region && params.region !== 'All Region') {
      query = query.eq('region', params.region)
    } else {
      // For "All Region", exclude records with NULL or N/A region to ensure consistency
      query = query.not('region', 'is', null).neq('region', 'N/A')
    }

    // Apply date filters
    if (params?.start_date && params?.end_date) {
      query = query
        .gte('started_at', `${params.start_date}T00:00:00`)
        .lte('started_at', `${params.end_date}T23:59:59`)
    }

    const { data, count, error } = await query

    if (error) throw error

    // Map to CallItem format
    const calls: CallItem[] = (data || []).map((row) => ({
      id: row.id_stat,
      started_at: row.started_at,
      call_id: row.call_id,
      interaction_id: row.interaction_id,
      phone_number: row.phone_number,
      duration_seconds: row.duration_seconds || 0,
      action: row.action || 'N/A',
      sentiment: row.sentiment || 'N/A',
      motivazione: row.motivazione,
      esito_chiamata: row.esito_chiamata,
    }))

    // Calculate pagination
    const total_calls = count || 0
    const total_pages = Math.ceil(total_calls / limit)
    const current_page = Math.floor(offset / limit) + 1
    const has_next = offset + limit < total_calls
    const has_previous = offset > 0

    return {
      calls,
      pagination: {
        total_calls,
        total_pages,
        current_page,
        has_next,
        has_previous,
        limit,
        offset,
      },
    }
  } catch (error) {
    console.error('Error loading calls:', error)
    return {
      calls: [],
      pagination: {
        total_calls: 0,
        total_pages: 0,
        current_page: 1,
        has_next: false,
        has_previous: false,
        limit: params?.limit || 100,
        offset: params?.offset || 0,
      },
    }
  }
}

/**
 * Get Call Summary
 *
 * Original SQL from dashboard.py:371-383:
 * SELECT call_id, started_at, ended_at, patient_intent,
 *        esito_chiamata, motivazione, summary, transcript
 * FROM tb_stat
 * WHERE call_id = $1
 * LIMIT 1
 */
export async function getCallSummary(callId: string) {
  try {
    const { data, error } = await supabase
      .from('tb_stat')
      .select('call_id, started_at, ended_at, patient_intent, esito_chiamata, motivazione, summary, transcript')
      .eq('call_id', callId)
      .single()

    if (error) throw error

    return {
      success: true,
      call_id: callId,
      summary: data.summary || 'Nessun summary disponibile',
      transcript: data.transcript || 'Nessun transcript disponibile',
      started_at: data.started_at,
      ended_at: data.ended_at,
      patient_intent: data.patient_intent,
      esito_chiamata: data.esito_chiamata,
      motivazione: data.motivazione,
      has_analysis: !!data.patient_intent,
      has_transcript: !!data.transcript,
    }
  } catch (error) {
    console.error('Error loading call summary:', error)
    throw new Error('Chiamata non trovata')
  }
}

/**
 * Get Available Regions
 *
 * Original SQL from dashboard.py:429-432:
 * SELECT DISTINCT region
 * FROM tb_stat
 * WHERE region IS NOT NULL
 * ORDER BY region ASC
 */
export async function getRegions(): Promise<Region[]> {
  try {
    const { data, error } = await supabase
      .from('tb_stat')
      .select('region')
      .not('region', 'is', null)
      .order('region', { ascending: true })

    if (error) throw error

    // Get unique regions (client-side DISTINCT)
    const uniqueRegions = [...new Set(data?.map((row) => row.region) || [])]

    // Build regions list with "All Region" first
    const regions: Region[] = [{ value: 'All Region', label: 'All Region' }]

    uniqueRegions.forEach((region) => {
      if (region) {
        regions.push({ value: region, label: region })
      }
    })

    return regions
  } catch (error) {
    console.error('Error loading regions:', error)
    return [{ value: 'All Region', label: 'All Region' }]
  }
}

/**
 * Get Additional Stats (Sentiment, Action, Hourly)
 *
 * Original SQL from dashboard.py:532-564:
 * - Sentiment stats: SELECT sentiment, COUNT(*) FROM tb_stat GROUP BY sentiment
 * - Action stats: SELECT action, COUNT(*), AVG(duration_seconds) FROM tb_stat GROUP BY action
 * - Hourly stats: SELECT EXTRACT(HOUR FROM started_at), COUNT(*) FROM tb_stat GROUP BY hour
 */
export async function getAdditionalStats(params?: {
  region?: string
  start_date?: string
  end_date?: string
}): Promise<AdditionalStats> {
  try {
    // Build base query
    let baseQuery = supabase
      .from('tb_stat')
      .select('sentiment, action, duration_seconds, started_at')
      .not('started_at', 'is', null)

    // Apply filters
    if (params?.region && params.region !== 'All Region') {
      baseQuery = baseQuery.eq('region', params.region)
    } else {
      // For "All Region", exclude records with NULL or N/A region to ensure consistency
      baseQuery = baseQuery.not('region', 'is', null).neq('region', 'N/A')
    }

    if (params?.start_date && params?.end_date) {
      baseQuery = baseQuery
        .gte('started_at', `${params.start_date}T00:00:00`)
        .lte('started_at', `${params.end_date}T23:59:59`)
    } else {
      // Last 27 days default
      const date27DaysAgo = new Date()
      date27DaysAgo.setDate(date27DaysAgo.getDate() - 27)
      baseQuery = baseQuery.gte('started_at', date27DaysAgo.toISOString())
    }

    const { data, error } = await baseQuery

    if (error) throw error

    // Client-side aggregation for sentiment stats
    const sentimentMap: Record<string, number> = {}
    const actionMap: Record<string, { count: number; total_duration: number }> = {}
    const hourlyMap: Record<number, number> = {}

    data?.forEach((row) => {
      // Sentiment stats
      if (row.sentiment) {
        sentimentMap[row.sentiment] = (sentimentMap[row.sentiment] || 0) + 1
      }

      // Action stats
      if (row.action) {
        if (!actionMap[row.action]) {
          actionMap[row.action] = { count: 0, total_duration: 0 }
        }
        actionMap[row.action].count += 1
        actionMap[row.action].total_duration += row.duration_seconds || 0
      }

      // Hourly stats
      if (row.started_at) {
        const hour = new Date(row.started_at).getHours()
        hourlyMap[hour] = (hourlyMap[hour] || 0) + 1
      }
    })

    // Convert to arrays
    const sentiment_stats = Object.entries(sentimentMap).map(([sentiment, count]) => ({
      sentiment,
      count,
    }))

    const action_stats = Object.entries(actionMap).map(([action, data]) => ({
      action,
      count: data.count,
      avg_duration: data.count > 0 ? data.total_duration / data.count : 0,
    }))

    const hourly_stats = Object.entries(hourlyMap).map(([hour, calls_count]) => ({
      hour: Number(hour),
      calls_count,
    }))

    return {
      sentiment_stats,
      action_stats,
      hourly_stats,
    }
  } catch (error) {
    console.error('Error loading additional stats:', error)
    return {
      sentiment_stats: [],
      action_stats: [],
      hourly_stats: [],
    }
  }
}

/**
 * Get Call Outcome Trend Over Time
 *
 * Original SQL from dashboard.py:826-834:
 * SELECT DATE(started_at) as date, esito_chiamata, COUNT(*) as count
 * FROM tb_stat
 * WHERE esito_chiamata IS NOT NULL
 * GROUP BY DATE(started_at), esito_chiamata
 * ORDER BY date DESC, esito_chiamata
 */
export async function getCallOutcomeTrend(params?: {
  region?: string
  start_date?: string
  end_date?: string
}): Promise<TrendResponse> {
  try {
    let query = supabase
      .from('tb_stat')
      .select('started_at, esito_chiamata')
      .not('esito_chiamata', 'is', null)
      .neq('esito_chiamata', '')
      .neq('esito_chiamata', 'NULL')

    // Apply filters
    if (params?.region && params.region !== 'All Region') {
      query = query.eq('region', params.region)
    } else {
      // For "All Region", exclude records with NULL or N/A region to ensure consistency
      query = query.not('region', 'is', null).neq('region', 'N/A')
    }

    if (params?.start_date && params?.end_date) {
      query = query
        .gte('started_at', `${params.start_date}T00:00:00`)
        .lte('started_at', `${params.end_date}T23:59:59`)
    } else {
      // Last 30 days default
      const date30DaysAgo = new Date()
      date30DaysAgo.setDate(date30DaysAgo.getDate() - 30)
      query = query.gte('started_at', date30DaysAgo.toISOString())
    }

    const { data, error } = await query

    if (error) throw error

    // Group by date and esito_chiamata
    const grouped: Record<string, Record<string, number>> = {}

    data?.forEach((row) => {
      const date = new Date(row.started_at!).toISOString().split('T')[0]
      const esito = row.esito_chiamata!

      if (!grouped[date]) {
        grouped[date] = {}
      }
      grouped[date][esito] = (grouped[date][esito] || 0) + 1
    })

    // Convert to array format
    const trendData: Array<{ date: string; esito_chiamata: string; count: number }> = []

    Object.entries(grouped).forEach(([date, esitos]) => {
      Object.entries(esitos).forEach(([esito_chiamata, count]) => {
        trendData.push({ date, esito_chiamata, count })
      })
    })

    // Sort by date DESC
    trendData.sort((a, b) => b.date.localeCompare(a.date))

    return {
      data: trendData,
      total_entries: trendData.length,
    }
  } catch (error) {
    console.error('Error loading call outcome trend:', error)
    return { data: [], total_entries: 0 }
  }
}

/**
 * Get Sentiment Trend Over Time
 *
 * Original SQL from dashboard.py:874-882:
 * SELECT DATE(started_at) as date, sentiment, COUNT(*) as count
 * FROM tb_stat
 * WHERE sentiment IS NOT NULL
 * GROUP BY DATE(started_at), sentiment
 * ORDER BY date DESC, sentiment
 */
export async function getSentimentTrend(params?: {
  region?: string
  start_date?: string
  end_date?: string
}): Promise<TrendResponse> {
  try {
    let query = supabase
      .from('tb_stat')
      .select('started_at, sentiment')
      .not('sentiment', 'is', null)
      .neq('sentiment', '')
      .neq('sentiment', 'NULL')

    // Apply filters
    if (params?.region && params.region !== 'All Region') {
      query = query.eq('region', params.region)
    } else {
      // For "All Region", exclude records with NULL or N/A region to ensure consistency
      query = query.not('region', 'is', null).neq('region', 'N/A')
    }

    if (params?.start_date && params?.end_date) {
      query = query
        .gte('started_at', `${params.start_date}T00:00:00`)
        .lte('started_at', `${params.end_date}T23:59:59`)
    } else {
      // Last 30 days default
      const date30DaysAgo = new Date()
      date30DaysAgo.setDate(date30DaysAgo.getDate() - 30)
      query = query.gte('started_at', date30DaysAgo.toISOString())
    }

    const { data, error } = await query

    if (error) throw error

    // Group by date and sentiment
    const grouped: Record<string, Record<string, number>> = {}

    data?.forEach((row) => {
      const date = new Date(row.started_at!).toISOString().split('T')[0]
      const sentiment = row.sentiment!

      if (!grouped[date]) {
        grouped[date] = {}
      }
      grouped[date][sentiment] = (grouped[date][sentiment] || 0) + 1
    })

    // Convert to array format
    const trendData: Array<{ date: string; sentiment: string; count: number }> = []

    Object.entries(grouped).forEach(([date, sentiments]) => {
      Object.entries(sentiments).forEach(([sentiment, count]) => {
        trendData.push({ date, sentiment, count })
      })
    })

    // Sort by date DESC
    trendData.sort((a, b) => b.date.localeCompare(a.date))

    return {
      data: trendData,
      total_entries: trendData.length,
    }
  } catch (error) {
    console.error('Error loading sentiment trend:', error)
    return { data: [], total_entries: 0 }
  }
}

/**
 * Get Call Outcome Stats (Esito + Motivazione)
 *
 * Original SQL from dashboard.py:674-691:
 * - Outcome stats: SELECT esito_chiamata, COUNT(*) FROM tb_stat GROUP BY esito_chiamata
 * - Motivation stats: SELECT esito_chiamata, motivazione, COUNT(*) FROM tb_stat GROUP BY esito_chiamata, motivazione
 */
export async function getCallOutcomeStats(params?: {
  region?: string
  start_date?: string
  end_date?: string
}): Promise<CallOutcomeStats> {
  try {
    let query = supabase
      .from('tb_stat')
      .select('esito_chiamata, motivazione')
      .not('esito_chiamata', 'is', null)
      .neq('esito_chiamata', '')
      .neq('esito_chiamata', 'NULL')

    // Apply filters
    if (params?.region && params.region !== 'All Region') {
      query = query.eq('region', params.region)
    } else {
      // For "All Region", exclude records with NULL or N/A region to ensure consistency
      query = query.not('region', 'is', null).neq('region', 'N/A')
    }

    if (params?.start_date && params?.end_date) {
      query = query
        .gte('started_at', `${params.start_date}T00:00:00`)
        .lte('started_at', `${params.end_date}T23:59:59`)
    }

    const { data, error } = await query

    if (error) throw error

    // Aggregate outcome stats
    const outcomeMap: Record<string, number> = {}
    const motivationMap: Record<string, number> = {}
    const combinedMap: Record<string, Record<string, number>> = {}

    data?.forEach((row) => {
      // Outcome stats
      outcomeMap[row.esito_chiamata!] = (outcomeMap[row.esito_chiamata!] || 0) + 1

      // Motivation stats (only for non-null motivazione)
      if (row.motivazione && row.motivazione !== '' && row.motivazione !== 'NULL') {
        motivationMap[row.motivazione] = (motivationMap[row.motivazione] || 0) + 1

        // Combined stats (esito + motivazione)
        const esito = row.esito_chiamata!
        if (!combinedMap[esito]) {
          combinedMap[esito] = {}
        }
        combinedMap[esito][row.motivazione] = (combinedMap[esito][row.motivazione] || 0) + 1
      }
    })

    // Convert to arrays
    const outcome_stats = Object.entries(outcomeMap).map(([esito_chiamata, count]) => ({
      esito_chiamata,
      count,
    }))

    const motivation_stats = Object.entries(motivationMap).map(([motivazione, count]) => ({
      motivazione,
      count,
    }))

    // Convert combined map to array
    const combined_stats: Array<{ esito_chiamata: string; motivazione: string; count: number }> = []
    Object.entries(combinedMap).forEach(([esito_chiamata, motivazioni]) => {
      Object.entries(motivazioni).forEach(([motivazione, count]) => {
        combined_stats.push({ esito_chiamata, motivazione, count })
      })
    })

    return {
      outcome_stats,
      motivation_stats,
      combined_stats,
      total_calls_with_outcome: data?.length || 0,
    }
  } catch (error) {
    console.error('Error loading call outcome stats:', error)
    return {
      outcome_stats: [],
      motivation_stats: [],
      combined_stats: [],
      total_calls_with_outcome: 0,
    }
  }
}
