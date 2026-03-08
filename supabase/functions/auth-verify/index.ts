/**
 * Auth Verify Edge Function
 * Replaces: GET /api/auth/verify from info_agent
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
    console.log(`✅ Token verified for user ${currentUser.user_id}`);
    // Update last_activity
    const supabase = createSupabaseClient();
    const authHeader = req.headers.get('Authorization');
    const token = authHeader.substring(7);
    await supabase.from('user_sessions').update({
      last_activity: new Date().toISOString()
    }).eq('token_hash', token);
    return new Response(JSON.stringify({
      valid: true,
      user: currentUser
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('❌ Token verification error:', error);
    return new Response(JSON.stringify({
      detail: 'Token non valido'
    }), {
      status: 401,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
