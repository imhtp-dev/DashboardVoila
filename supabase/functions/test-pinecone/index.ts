/**
 * Test Pinecone Connection
 * Verifies OpenAI embeddings and Pinecone upsert work correctly
 */ import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { generateEmbedding, upsertToPinecone, generatePineconeId } from '../_shared/pinecone.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
serve(async (req)=>{
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  try {
    const testQuestion = "Qual è l'orario di apertura?";
    const testAnswer = "Siamo aperti dal lunedì al venerdì dalle 9:00 alle 18:00";
    const testRegion = "Lombardia";
    const testQaId = 99999;
    console.log('🧪 Testing Pinecone integration...');
    // Step 1: Check environment variables
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    const pineconeKey = Deno.env.get('PINECONE_API_KEY');
    const pineconeHost = Deno.env.get('PINECONE_HOST');
    const envCheck = {
      openai_available: !!openaiKey,
      openai_prefix: openaiKey ? openaiKey.substring(0, 7) : 'NOT_SET',
      pinecone_available: !!pineconeKey,
      pinecone_host_available: !!pineconeHost,
      pinecone_host: pineconeHost || 'NOT_SET'
    };
    console.log('✅ Environment check:', envCheck);
    // Step 2: Generate embedding
    console.log('🔮 Generating test embedding...');
    const embedding = await generateEmbedding(testQuestion);
    console.log(`✅ Embedding generated (${embedding.length} dimensions)`);
    // Step 3: Generate Pinecone ID
    const pineconeId = generatePineconeId(testRegion, testQaId);
    console.log(`✅ Pinecone ID: ${pineconeId}`);
    // Step 4: Upsert to Pinecone
    console.log('📌 Upserting to Pinecone...');
    await upsertToPinecone(pineconeId, embedding, {
      question: testQuestion,
      answer: testAnswer,
      regione: testRegion,
      qa_id: testQaId,
      test: true
    });
    console.log('✅ Upsert successful!');
    return new Response(JSON.stringify({
      success: true,
      message: 'Pinecone test successful!',
      env_check: envCheck,
      test_data: {
        question: testQuestion,
        pinecone_id: pineconeId,
        embedding_dimensions: embedding.length
      }
    }, null, 2), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('❌ Pinecone test failed:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack
    }, null, 2), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
