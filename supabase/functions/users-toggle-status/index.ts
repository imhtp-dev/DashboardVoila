/**
 * Users Toggle Status Edge Function
 * Replaces: PUT /api/users/{id}/toggle-status from info_agent
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
    const url = new URL(req.url);
    const userId = url.pathname.split('/').pop();
    console.log(`🔄 Toggling status for user ${userId} (by ${currentUser.email})`);
    if (!userId || userId === 'users-toggle-status') {
      throw new Error('User ID is required');
    }
    const supabase = createSupabaseClient();
    // Get current user status
    const { data: user, error: fetchError } = await supabase.from('users').select('is_active').eq('user_id', parseInt(userId)).single();
    if (fetchError || !user) {
      throw new Error('Utente non trovato');
    }
    // Toggle status
    const newStatus = !user.is_active;
    const { error: updateError } = await supabase.from('users').update({
      is_active: newStatus,
      updated_at: new Date().toISOString()
    }).eq('user_id', parseInt(userId));
    if (updateError) throw updateError;
    console.log(`✅ User ${userId} status changed to ${newStatus}`);
    return new Response(JSON.stringify({
      success: true,
      message: `Utente ${newStatus ? 'attivato' : 'disattivato'} con successo`,
      new_status: newStatus
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('❌ Error toggling user status:', error);
    return new Response(JSON.stringify({
      detail: error.message || 'Errore nell\'aggiornamento dello stato'
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
