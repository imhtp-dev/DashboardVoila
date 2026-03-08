/**
 * Auth Logout Edge Function
 * Replaces: POST /api/auth/logout from info_agent
 */ import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { extractToken } from '../_shared/auth.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
serve(async (req)=>{
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  try {
    const token = extractToken(req);
    console.log(`🔐 Logout request for token: ${token.substring(0, 20)}...`);
    const supabase = createSupabaseClient();
    // Delete session from database
    await supabase.from('user_sessions').delete().eq('token_hash', token);
    console.log('✅ Session deleted from database');
    return new Response(JSON.stringify({
      success: true,
      message: 'Logout effettuato con successo'
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('❌ Logout error:', error);
    // Always return success for logout
    return new Response(JSON.stringify({
      success: true,
      message: 'Logout effettuato con successo'
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
