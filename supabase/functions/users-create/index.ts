/**
 * Users Create Edge Function
 * Replaces: POST /api/users from info_agent
 */ import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { getCurrentUser, generatePassword, hashPassword } from '../_shared/auth.ts';
import { sendRegistrationEmail } from '../_shared/email.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
serve(async (req)=>{
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  try {
    const currentUser = await getCurrentUser(req);
    const { nome, cognome, email, ruolo } = await req.json();
    console.log(`👤 Creating new user: ${email} (by ${currentUser.email})`);
    // Validate input
    if (!nome?.trim()) {
      throw new Error('Il nome è obbligatorio');
    }
    if (!cognome?.trim()) {
      throw new Error('Il cognome è obbligatorio');
    }
    if (!email?.trim()) {
      throw new Error('L\'email è obbligatoria');
    }
    if (!ruolo) {
      throw new Error('Il ruolo è obbligatorio');
    }
    const supabase = createSupabaseClient();
    // Check if user already exists
    const { data: existingUser } = await supabase.from('users').select('user_id').eq('email', email.trim()).single();
    if (existingUser) {
      throw new Error('Un utente con questa email esiste già');
    }
    // Generate password
    const password = generatePassword(12);
    const passwordHash = await hashPassword(password);
    // Full name
    const fullName = `${nome.trim()} ${cognome.trim()}`;

    // Determine role and region based on ruolo input
    // If ruolo is "master" → role="admin", region="master" (admin user with full access)
    // If ruolo is a region name (like "Lombardia") → role="user", region=ruolo (regional user)
    let finalRole: string;
    let finalRegion: string;

    if (ruolo === 'master') {
      finalRole = 'admin';
      finalRegion = 'master';
      console.log(`👑 Creating admin user: ${email.trim()}`);
    } else {
      finalRole = 'user';
      finalRegion = ruolo; // Use the region name directly (e.g., "Lombardia", "Veneto")
      console.log(`🌍 Creating regional user for region: ${ruolo}`);
    }

    // Create user
    const { data: newUser, error } = await supabase.from('users').insert({
      email: email.trim(),
      name: fullName,
      password_hash: passwordHash,
      role: finalRole,
      region: finalRegion,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).select().single();
    if (error) throw error;
    console.log(`✅ User ${newUser.user_id} created successfully`);
    // Send email with credentials
    let emailSent = false;
    try {
      emailSent = await sendRegistrationEmail(email.trim(), fullName, password);
    } catch (emailError) {
      console.error('❌ Error sending email:', emailError);
    // Don't fail user creation if email fails
    }
    return new Response(JSON.stringify({
      success: true,
      message: 'Utente creato con successo',
      user_id: newUser.user_id,
      email_sent: emailSent
    }), {
      status: 201,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('❌ Error creating user:', error);
    return new Response(JSON.stringify({
      detail: error.message || 'Errore nella creazione dell\'utente'
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
