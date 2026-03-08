/**
 * Q&A Update Edge Function
 * Replaces: PUT /api/qa/{id} from info_agent
 *
 * This updates Q&A in Supabase AND regenerates embedding in Pinecone
 */ import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { getCurrentUser } from '../_shared/auth.ts';
import { generateEmbedding, upsertToPinecone, deleteFromPinecone, generatePineconeId } from '../_shared/pinecone.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
serve(async (req)=>{
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  try {
    const currentUser = await getCurrentUser(req);
    const { qa_id, question, answer } = await req.json();
    console.log(`✏️ Updating Q&A ${qa_id} (by ${currentUser.email})`);
    if (!qa_id) {
      throw new Error('Q&A ID is required');
    }
    // Validate input
    if (!question?.trim()) {
      throw new Error('La domanda è obbligatoria');
    }
    if (!answer?.trim()) {
      throw new Error('La risposta è obbligatoria');
    }
    const supabase = createSupabaseClient();
    // Get existing Q&A
    const { data: existingQa, error: fetchError } = await supabase.from('qa_entries').select('*').eq('qa_id', parseInt(qa_id)).single();
    if (fetchError || !existingQa) {
      throw new Error('Q&A non trovata');
    }
    // Check regional access
    if (currentUser.region !== 'master' && currentUser.region !== existingQa.region) {
      throw new Error('Non autorizzato a modificare questa Q&A');
    }
    // Restrict Nazionale updates to admin users only (case-sensitive)
    console.log(`🔒 Checking Nazionale update access: qa_region=${existingQa.region}, user_role=${currentUser.role}`);
    if (existingQa.region === 'Nazionale' && currentUser.role !== 'admin') {
      console.log(`❌ Access denied: Non-admin user ${currentUser.email} attempted to update Nazionale Q&A ${qa_id}`);
      throw new Error('Solo gli utenti admin possono modificare Q&A nazionali');
    }
    if (existingQa.region === 'Nazionale') {
      console.log(`✅ Admin user ${currentUser.email} updating Nazionale Q&A ${qa_id}`);
    }
    const oldPineconeId = existingQa.pinecone_id;
    // Step 1: Delete old Pinecone vector (if exists)
    if (oldPineconeId) {
      console.log('🗑️ Deleting old Pinecone vector...');
      try {
        await deleteFromPinecone(oldPineconeId);
      } catch (error) {
        console.error('⚠️ Warning: Failed to delete old Pinecone vector', error);
      }
    }
    // Step 2: Generate new embedding
    console.log('🔮 Generating new embedding...');
    const embedding = await generateEmbedding(question.trim());
    // Step 3: Create new Pinecone ID
    const newPineconeId = generatePineconeId(existingQa.region, existingQa.qa_id);
    // Step 4: Upsert to Pinecone
    console.log('📌 Upserting to Pinecone...');
    await upsertToPinecone(newPineconeId, embedding, {
      question: question.trim(),
      answer: answer.trim(),
      regione: existingQa.region,
      qa_id: existingQa.qa_id
    });
    // Step 5: Update Supabase
    const { error: updateError } = await supabase.from('qa_entries').update({
      question: question.trim(),
      answer: answer.trim(),
      pinecone_id: newPineconeId,
      updated_by: currentUser.name,
      updated_at: new Date().toISOString()
    }).eq('qa_id', parseInt(qa_id));
    if (updateError) throw updateError;
    console.log(`✅ Q&A ${qa_id} updated successfully`);
    return new Response(JSON.stringify({
      success: true,
      message: 'Q&A aggiornata con successo',
      qa_id: parseInt(qa_id),
      old_pinecone_id: oldPineconeId,
      new_pinecone_id: newPineconeId,
      updated_by: currentUser.name,
      updated_at: new Date().toISOString(),
      updated_at_timezone: 'Europe/Rome'
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('❌ Error updating Q&A:', error);
    return new Response(JSON.stringify({
      detail: error.message || 'Errore nell\'aggiornamento della Q&A'
    }), {
      status: error.message.includes('autorizzato') ? 403 : 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
