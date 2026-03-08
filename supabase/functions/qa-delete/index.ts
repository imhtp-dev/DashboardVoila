/**
 * Q&A Delete Edge Function
 * Replaces: DELETE /api/qa/{id} from info_agent
 *
 * This deletes Q&A from both Supabase AND Pinecone
 */ import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { getCurrentUser } from '../_shared/auth.ts';
import { deleteFromPinecone } from '../_shared/pinecone.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
serve(async (req)=>{
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  try {
    const currentUser = await getCurrentUser(req);
    const url = new URL(req.url);
    const qaId = url.searchParams.get('qa_id');
    console.log(`🗑️ Deleting Q&A ${qaId} (by ${currentUser.email})`);
    if (!qaId) {
      throw new Error('Q&A ID is required');
    }
    const supabase = createSupabaseClient();
    // Get existing Q&A
    const { data: existingQa, error: fetchError } = await supabase.from('qa_entries').select('*').eq('qa_id', parseInt(qaId)).single();
    if (fetchError || !existingQa) {
      throw new Error('Q&A non trovata');
    }
    // Check regional access
    if (currentUser.region !== 'master' && currentUser.region !== existingQa.region) {
      throw new Error('Non autorizzato a eliminare questa Q&A');
    }
    // Restrict Nazionale deletion to admin users only (case-sensitive)
    console.log(`🔒 Checking Nazionale delete access: qa_region=${existingQa.region}, user_role=${currentUser.role}`);
    if (existingQa.region === 'Nazionale' && currentUser.role !== 'admin') {
      console.log(`❌ Access denied: Non-admin user ${currentUser.email} attempted to delete Nazionale Q&A ${qaId}`);
      throw new Error('Solo gli utenti admin possono eliminare Q&A nazionali');
    }
    if (existingQa.region === 'Nazionale') {
      console.log(`✅ Admin user ${currentUser.email} deleting Nazionale Q&A ${qaId}`);
    }
    const pineconeId = existingQa.pinecone_id;
    // Step 1: Delete from Pinecone (if exists)
    if (pineconeId) {
      console.log('📌 Deleting from Pinecone...');
      try {
        await deleteFromPinecone(pineconeId);
      } catch (error) {
        console.error('⚠️ Warning: Failed to delete from Pinecone', error);
      // Continue with database deletion even if Pinecone fails
      }
    }
    // Step 2: Delete from Supabase
    const { error: deleteError } = await supabase.from('qa_entries').delete().eq('qa_id', parseInt(qaId));
    if (deleteError) throw deleteError;
    console.log(`✅ Q&A ${qaId} deleted successfully`);
    return new Response(JSON.stringify({
      success: true,
      message: 'Q&A eliminata con successo',
      qa_id: parseInt(qaId),
      pinecone_id: pineconeId
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('❌ Error deleting Q&A:', error);
    return new Response(JSON.stringify({
      detail: error.message || 'Errore nell\'eliminazione della Q&A'
    }), {
      status: error.message.includes('autorizzato') ? 403 : 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
