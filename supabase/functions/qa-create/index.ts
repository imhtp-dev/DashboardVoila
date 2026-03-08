/**
 * Q&A Create Edge Function
 * Replaces: POST /api/qa from info_agent
 *
 * This creates Q&A in Supabase AND syncs to Pinecone vector database
 */ import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { getCurrentUser } from '../_shared/auth.ts';
import { generateEmbedding, upsertToPinecone, generatePineconeId } from '../_shared/pinecone.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
serve(async (req)=>{
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  try {
    const currentUser = await getCurrentUser(req);
    const { question, answer, region } = await req.json();
    console.log(`📝 Creating Q&A for region: ${region} (by ${currentUser.email})`);
    // Validate input
    if (!question?.trim()) {
      throw new Error('La domanda è obbligatoria');
    }
    if (!answer?.trim()) {
      throw new Error('La risposta è obbligatoria');
    }
    if (!region) {
      throw new Error('La regione è obbligatoria');
    }
    // Check regional access
    if (currentUser.region !== 'master' && currentUser.region !== region) {
      throw new Error('Non autorizzato a creare Q&A per questa regione');
    }
    // Restrict Nazionale creation to admin users only (case-sensitive)
    console.log(`🔒 Checking Nazionale access: region=${region}, user_role=${currentUser.role}`);
    if (region === 'Nazionale' && currentUser.role !== 'admin') {
      console.log(`❌ Access denied: Non-admin user ${currentUser.email} attempted to create Nazionale Q&A`);
      throw new Error('Solo gli utenti admin possono creare Q&A nazionali');
    }
    if (region === 'Nazionale') {
      console.log(`✅ Admin user ${currentUser.email} creating Nazionale Q&A`);
    }
    const supabase = createSupabaseClient();
    // Generate id_domanda (unique question identifier)
    const timestamp = Date.now();
    const idDomanda = `q_${region}_${timestamp}`;
    // Step 1: Insert to Supabase
    const { data: qaEntry, error: dbError } = await supabase.from('qa_entries').insert({
      question: question.trim(),
      answer: answer.trim(),
      region,
      id_domanda: idDomanda,
      created_by: currentUser.name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).select().single();
    if (dbError) throw dbError;
    console.log(`✅ Q&A ${qaEntry.qa_id} created in database with id_domanda: ${idDomanda}`);
    // Step 2: Generate embedding
    console.log('🔮 Generating embedding...');
    const embedding = await generateEmbedding(question.trim());
    // Step 3: Create Pinecone ID
    const pineconeId = generatePineconeId(region, qaEntry.qa_id);
    // Step 4: Upsert to Pinecone
    console.log('📌 Upserting to Pinecone...');
    await upsertToPinecone(pineconeId, embedding, {
      question: question.trim(),
      answer: answer.trim(),
      regione: region,
      qa_id: qaEntry.qa_id,
      id_domanda: idDomanda
    });
    // Step 5: Update Supabase with pinecone_id
    const { error: updateError } = await supabase.from('qa_entries').update({
      pinecone_id: pineconeId
    }).eq('qa_id', qaEntry.qa_id);
    if (updateError) {
      console.error('⚠️ Warning: Failed to update pinecone_id in database', updateError);
    }
    console.log(`✅ Q&A ${qaEntry.qa_id} fully created (DB + Pinecone)`);
    return new Response(JSON.stringify({
      success: true,
      message: 'Q&A creata con successo',
      qa_id: qaEntry.qa_id,
      pinecone_id: pineconeId,
      id_domanda: qaEntry.id_domanda,
      created_by: currentUser.name,
      created_at: qaEntry.created_at,
      updated_at: qaEntry.updated_at,
      timezone: 'Europe/Rome'
    }), {
      status: 201,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('❌ Error creating Q&A:', error);
    return new Response(JSON.stringify({
      detail: error.message || 'Errore nella creazione della Q&A'
    }), {
      status: error.message.includes('autorizzato') ? 403 : 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
