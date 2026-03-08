/**
 * Auth Login Edge Function
 * Replaces: POST /api/auth/login from info_agent
 */ import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { verifyPassword, generateToken } from '../_shared/auth.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
serve(async (req)=>{
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  try {
    const { email, password, remember_me } = await req.json();
    console.log(`🔐 Login attempt for: ${email}`);
    const supabase = createSupabaseClient();
    // Get user from database
    const { data: user, error } = await supabase.from('users').select('*').eq('email', email).single();
    if (error || !user) {
      console.log(`❌ User ${email} not found`);
      return new Response(JSON.stringify({
        detail: 'Email o password non corretti'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    if (!user.is_active) {
      console.log(`❌ User ${email} is not active`);
      return new Response(JSON.stringify({
        detail: 'Account disattivato. Contatta l\'amministratore.'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Verify password
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      console.log(`❌ Invalid password for user ${email}`);
      return new Response(JSON.stringify({
        detail: 'Email o password non corretti'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log(`✅ User ${user.email} authenticated successfully`);
    // Generate token
    const token = generateToken(user.user_id);
    // Calculate expiration time
    // Without "Ricordami": 24 hours (login once per day)
    // With "Ricordami": 7 days (login once per week)
    const expireHours = remember_me ? 168 : 24; // 168 hours = 7 days
    const expiresAt = new Date(Date.now() + expireHours * 60 * 60 * 1000);
    const currentTime = new Date();
    // Upsert session (insert or update if user_id already exists)
    const { error: sessionError } = await supabase.from('user_sessions').upsert({
      user_id: user.user_id,
      token_hash: token,
      created_at: currentTime.toISOString(),
      expires_at: expiresAt.toISOString(),
      last_activity: currentTime.toISOString()
    }, {
      onConflict: 'user_id'
    });
    if (sessionError) {
      console.error(`❌ Session creation error:`, sessionError);
      throw sessionError;
    }
    console.log(`✅ Session created for user ${user.user_id}`);
    return new Response(JSON.stringify({
      success: true,
      message: 'Login effettuato con successo',
      access_token: token,
      token_type: 'bearer',
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
    console.error('❌ Login error:', error);
    return new Response(JSON.stringify({
      detail: 'Errore interno del server'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
