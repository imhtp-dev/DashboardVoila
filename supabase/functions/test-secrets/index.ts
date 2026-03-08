/**
 * Test Secrets - Verify environment variables are accessible
 */ import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
serve(async (req)=>{
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  try {
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    const pineconeKey = Deno.env.get('PINECONE_API_KEY');
    const pineconeHost = Deno.env.get('PINECONE_HOST');
    const result = {
      openai_available: !!openaiKey,
      openai_prefix: openaiKey ? openaiKey.substring(0, 7) : 'NOT_SET',
      pinecone_available: !!pineconeKey,
      pinecone_host_available: !!pineconeHost,
      all_env_vars: Object.keys(Deno.env.toObject()).filter((k)=>k.includes('API') || k.includes('PINECONE'))
    };
    return new Response(JSON.stringify(result, null, 2), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
