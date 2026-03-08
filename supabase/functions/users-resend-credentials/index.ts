/**
 * Users Resend Credentials Edge Function
 * Replaces: POST /api/users/{id}/resend-credentials from info_agent
 */ import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { getCurrentUser, generatePassword, hashPassword } from '../_shared/auth.ts';
import { sendPasswordResetEmail } from '../_shared/email.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
serve(async (req)=>{
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  try {
    const currentUser = await getCurrentUser(req);

    // Parse request body
    const body = await req.json();
    const userId = body.user_id;

    console.log(`📧 Resending credentials for user ${userId} (by ${currentUser.email})`);
    if (!userId) {
      throw new Error('User ID is required');
    }
    const supabase = createSupabaseClient();
    // Get user
    const { data: user, error: fetchError } = await supabase.from('users').select('*').eq('user_id', parseInt(userId)).single();
    if (fetchError || !user) {
      throw new Error('Utente non trovato');
    }
    // Generate new password
    const newPassword = generatePassword(12);
    const passwordHash = await hashPassword(newPassword);
    // Update password
    const { error: updateError } = await supabase.from('users').update({
      password_hash: passwordHash,
      updated_at: new Date().toISOString()
    }).eq('user_id', parseInt(userId));
    if (updateError) throw updateError;
    console.log(`✅ Password reset for user ${userId}`);
    // Send password reset email
    let emailSent = false;
    try {
      emailSent = await sendPasswordResetEmail(user.email, user.name, newPassword);
    } catch (emailError) {
      console.error('❌ Error sending email:', emailError);
      throw new Error('Password aggiornata ma errore nell\'invio dell\'email');
    }
    return new Response(JSON.stringify({
      success: true,
      message: 'Nuove credenziali inviate via email',
      email_sent: emailSent
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('❌ Error resending credentials:', error);
    return new Response(JSON.stringify({
      detail: error.message || 'Errore nell\'invio delle credenziali'
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
