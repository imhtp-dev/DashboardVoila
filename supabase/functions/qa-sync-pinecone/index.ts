/**
 * Q&A Sync to Pinecone
 * Syncs all Q&A entries that don't have a pinecone_id yet
 *
 * This fixes entries created before the Supabase migration
 */ import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { getCurrentUser } from '../_shared/auth.ts';
import { generateEmbedding, upsertToPinecone, generatePineconeId } from '../_shared/pinecone.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
serve(async (req)=>{
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  try {
    const currentUser = await getCurrentUser(req);
    // Only master users can run this
    if (currentUser.region !== 'master') {
      throw new Error('Solo gli utenti master possono sincronizzare Pinecone');
    }
    console.log(`🔄 Starting Pinecone sync (by ${currentUser.email})`);
    const supabase = createSupabaseClient();
    // Get all Q&A entries without pinecone_id
    const { data: qaEntries, error: fetchError } = await supabase.from('qa_entries').select('*').is('pinecone_id', null);
    if (fetchError) throw fetchError;
    if (!qaEntries || qaEntries.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Nessuna Q&A da sincronizzare',
        synced_count: 0
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log(`📋 Found ${qaEntries.length} Q&A entries to sync`);
    const results = [];
    let successCount = 0;
    let failCount = 0;
    for (const qa of qaEntries){
      try {
        console.log(`📝 Syncing Q&A ${qa.qa_id}: "${qa.question.substring(0, 50)}..."`);
        // Generate embedding
        const embedding = await generateEmbedding(qa.question);
        // Generate Pinecone ID
        const pineconeId = generatePineconeId(qa.region, qa.qa_id);
        // Generate id_domanda if missing
        const idDomanda = qa.id_domanda || `q_${qa.region}_${Date.now()}_${qa.qa_id}`;
        // Upsert to Pinecone
        await upsertToPinecone(pineconeId, embedding, {
          question: qa.question,
          answer: qa.answer,
          regione: qa.region,
          qa_id: qa.qa_id,
          id_domanda: idDomanda
        });
        // Update Supabase with pinecone_id and id_domanda
        const updateData = {
          pinecone_id: pineconeId
        };
        if (!qa.id_domanda) {
          updateData.id_domanda = idDomanda;
        }
        const { error: updateError } = await supabase.from('qa_entries').update(updateData).eq('qa_id', qa.qa_id);
        if (updateError) {
          console.error(`⚠️ Failed to update DB for Q&A ${qa.qa_id}:`, updateError);
          failCount++;
          results.push({
            qa_id: qa.qa_id,
            success: false,
            error: updateError.message
          });
        } else {
          console.log(`✅ Q&A ${qa.qa_id} synced successfully`);
          successCount++;
          results.push({
            qa_id: qa.qa_id,
            success: true,
            pinecone_id: pineconeId
          });
        }
      } catch (error) {
        console.error(`❌ Failed to sync Q&A ${qa.qa_id}:`, error);
        failCount++;
        results.push({
          qa_id: qa.qa_id,
          success: false,
          error: error.message
        });
      }
    }
    console.log(`✅ Sync complete: ${successCount} success, ${failCount} failed`);
    return new Response(JSON.stringify({
      success: true,
      message: `Sincronizzazione completata: ${successCount} successi, ${failCount} falliti`,
      total_entries: qaEntries.length,
      synced_count: successCount,
      failed_count: failCount,
      results
    }, null, 2), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('❌ Sync failed:', error);
    return new Response(JSON.stringify({
      success: false,
      detail: error.message || 'Errore durante la sincronizzazione'
    }), {
      status: error.message.includes('master') ? 403 : 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
