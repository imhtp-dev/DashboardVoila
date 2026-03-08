/**
 * Auth Login Test - Simplified version to debug
 */ import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
serve(async (req)=>{
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const { email, password } = await req.json();
    console.log('🔐 Login attempt for:', email);
    console.log('📍 Environment check:');
    console.log('  SUPABASE_URL:', Deno.env.get('SUPABASE_URL') ? 'SET' : 'MISSING');
    console.log('  SUPABASE_SERVICE_ROLE_KEY:', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ? 'SET' : 'MISSING');
    const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    console.log('✅ Supabase client created');
    // Test database connection
    const { data: user, error } = await supabase.from('users').select('*').eq('email', email).single();
    console.log('📊 Database query result:');
    console.log('  Error:', error);
    console.log('  User found:', !!user);
    if (error) {
      console.error('❌ Database error:', error);
      return new Response(JSON.stringify({
        detail: 'Database error',
        error: error.message,
        code: error.code
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    if (!user) {
      return new Response(JSON.stringify({
        detail: 'User not found'
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // For testing, skip password verification
    console.log('✅ User found:', user.email);
    return new Response(JSON.stringify({
      success: true,
      message: 'Test successful - user found in database',
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
    console.error('❌ Unexpected error:', error);
    return new Response(JSON.stringify({
      detail: 'Internal server error',
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
