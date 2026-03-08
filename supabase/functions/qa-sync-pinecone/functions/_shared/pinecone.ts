/**
 * Pinecone Vector Database Utilities
 */ /**
 * Generate embedding using OpenAI API
 */ export async function generateEmbedding(text) {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'text-embedding-3-large',
      input: text,
      dimensions: 1024
    })
  });
  if (!response.ok) {
    const error = await response.text();
    console.error('❌ OpenAI API error:', error);
    throw new Error('Failed to generate embedding');
  }
  const { data } = await response.json();
  return data[0].embedding;
}
/**
 * Upsert vector to Pinecone
 */ export async function upsertToPinecone(vectorId, embedding, metadata) {
  const pineconeApiKey = Deno.env.get('PINECONE_API_KEY');
  const pineconeHost = Deno.env.get('PINECONE_HOST');
  if (!pineconeApiKey || !pineconeHost) {
    throw new Error('Pinecone credentials not configured');
  }
  const response = await fetch(`${pineconeHost}/vectors/upsert`, {
    method: 'POST',
    headers: {
      'Api-Key': pineconeApiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      vectors: [
        {
          id: vectorId,
          values: embedding,
          metadata
        }
      ],
      namespace: '' // Default namespace
    })
  });
  if (!response.ok) {
    const error = await response.text();
    console.error('❌ Pinecone upsert error:', error);
    throw new Error('Failed to upsert to Pinecone');
  }
  console.log(`✅ Vector ${vectorId} upserted to Pinecone`);
}
/**
 * Delete vector from Pinecone
 */ export async function deleteFromPinecone(vectorId) {
  const pineconeApiKey = Deno.env.get('PINECONE_API_KEY');
  const pineconeHost = Deno.env.get('PINECONE_HOST');
  if (!pineconeApiKey || !pineconeHost) {
    throw new Error('Pinecone credentials not configured');
  }
  const response = await fetch(`${pineconeHost}/vectors/delete`, {
    method: 'POST',
    headers: {
      'Api-Key': pineconeApiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ids: [
        vectorId
      ],
      namespace: ''
    })
  });
  if (!response.ok) {
    const error = await response.text();
    console.error('❌ Pinecone delete error:', error);
    throw new Error('Failed to delete from Pinecone');
  }
  console.log(`✅ Vector ${vectorId} deleted from Pinecone`);
}
/**
 * Generate Pinecone ID
 */ export function generatePineconeId(region, qaId) {
  const timestamp = Date.now();
  return `qa_${region}_${qaId}_${timestamp}`;
}
