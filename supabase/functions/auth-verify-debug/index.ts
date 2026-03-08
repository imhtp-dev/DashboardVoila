/**
 * Auth Verify Debug - Detailed logging to debug token verification
 */ import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
serve(async (req)=>{
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  try {
    console.log('=== AUTH-VERIFY DEBUG START ===');
    // Extract token
    const authHeader = req.headers.get('Authorization');
    console.log('Authorization header:', authHeader ? `${authHeader.substring(0, 50)}...` : 'MISSING');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({
        detail: 'Token mancante - no Bearer header'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const token = authHeader.substring(7);
    console.log('Extracted token:', token.substring(0, 30) + '...');
    console.log('Token length:', token.length);
    const supabase = createSupabaseClient();
    // Query session
    console.log('Querying user_sessions with token_hash...');
    const { data, error } = await supabase.from('user_sessions').select(`
        user_id,
        expires_at,
        users!inner (
          user_id,
          email,
          name,
          role,
          region,
          is_active
        )
      `).eq('token_hash', token).single();
    console.log('Query completed');
    console.log('Error:', error);
    console.log('Data:', data ? 'Found' : 'NULL');
    if (error) {
      console.error('Database error details:', JSON.stringify(error, null, 2));
      return new Response(JSON.stringify({
        detail: 'Database error',
        error: error.message,
        code: error.code,
        hint: error.hint
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    if (!data) {
      // Try to find ANY session for debugging
      console.log('No session found. Checking all sessions...');
      const { data: allSessions } = await supabase.from('user_sessions').select('user_id, token_hash, expires_at').limit(5);
      console.log('Sample sessions:', allSessions?.map((s)=>({
          user_id: s.user_id,
          token_prefix: s.token_hash?.substring(0, 20),
          expires_at: s.expires_at
        })));
      return new Response(JSON.stringify({
        detail: 'No session found for token',
        searched_token_prefix: token.substring(0, 30),
        sample_sessions_count: allSessions?.length || 0
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log('Session found for user_id:', data.user_id);
    console.log('Expires at:', data.expires_at);
    // Check expiration
    const expiresAt = new Date(data.expires_at);
    const now = new Date();
    console.log('Expiration check:', expiresAt, '>', now, '=', expiresAt > now);
    if (expiresAt < now) {
      return new Response(JSON.stringify({
        detail: 'Token scaduto',
        expires_at: data.expires_at,
        current_time: now.toISOString()
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const user = data.users;
    console.log('User active:', user.is_active);
    if (!user.is_active) {
      return new Response(JSON.stringify({
        detail: 'Account disattivato'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log('=== AUTH-VERIFY DEBUG SUCCESS ===');
    return new Response(JSON.stringify({
      valid: true,
      user: {
        user_id: user.user_id,
        email: user.email,
        name: user.name,
        role: user.role,
        region: user.region
      }
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('=== UNEXPECTED ERROR ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    return new Response(JSON.stringify({
      detail: 'Internal server error',
      error_type: error.constructor.name,
      error_message: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
