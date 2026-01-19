/**
 * Supabase Client for Direct Database Access
 * Replaces API calls to info_agent with direct Supabase queries
 */

import { createClient } from '@supabase/supabase-js'

// Supabase connection (uses same database as all agents)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  db: {
    schema: 'public'
  }
})

// Export for type checking
export type Database = {
  public: {
    Tables: {
      tb_stat: {
        Row: {
          id_stat: number
          call_id: string | null
          interaction_id: string | null
          started_at: string | null
          ended_at: string | null
          phone_number: string | null
          duration_seconds: number | null
          action: string | null
          sentiment: string | null
          region: string | null
          motivazione: string | null
          esito_chiamata: string | null
          patient_intent: string | null
          summary: string | null
          transcript: string | null
          call_type: string | null  // 'info' | 'booking' | 'booking_incomplete' | 'N/A'
          booking_code: string | null
        }
      }
      tb_voice_agent: {
        Row: {
          id_voice_agent: number
          regione: string
          assistant_id: string
          public: boolean
        }
      }
    }
  }
}
