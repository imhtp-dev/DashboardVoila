/**
 * Users Delete Edge Function
 * Replaces: DELETE /api/users/{id} from info_agent
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
    const userId = url.searchParams.get('user_id');
    console.log(`🗑️ Deleting user ${userId} (by ${currentUser.email})`);
    if (!userId) {
      throw new Error('User ID is required');
    }
    const supabase = createSupabaseClient();
    // Delete user sessions first (foreign key)
    await supabase.from('user_sessions').delete().eq('user_id', parseInt(userId));
    // Delete user
    const { error } = await supabase.from('users').delete().eq('user_id', parseInt(userId));
    if (error) throw error;
    console.log(`✅ User ${userId} deleted successfully`);
    return new Response(JSON.stringify({
      success: true,
      message: 'Utente eliminato con successo'
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('❌ Error deleting user:', error);
    return new Response(JSON.stringify({
      detail: error.message || 'Errore nell\'eliminazione dell\'utente'
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
