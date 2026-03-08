/**
 * Users List Edge Function
 * Replaces: GET /api/users from info_agent
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
    console.log(`👥 Listing users (requested by ${currentUser.email})`);
    const supabase = createSupabaseClient();
    const { data: users, error } = await supabase.from('users').select('user_id, email, name, role, region, is_active, created_at, updated_at').order('created_at', {
      ascending: false
    });
    if (error) throw error;
    console.log(`✅ Found ${users?.length || 0} users`);
    return new Response(JSON.stringify(users || []), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('❌ Error listing users:', error);
    return new Response(JSON.stringify({
      detail: error.message || 'Errore nel caricamento degli utenti'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
