import { NextRequest, NextResponse } from 'next/server';

interface VapiRequestBody {
  message: string;
  previous_chat_id?: string | null;
}

interface VapiResponse {
  id: string;
  output: Array<{
    role: string;
    content?: string;
    tool_calls?: Array<{
      function: {
        name: string;
      };
    }>;
  }>;
}

interface ChatResponse {
  chat_id: string;
  response: string;
  function_called: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const { message, previous_chat_id }: VapiRequestBody = await request.json();

    if (!message || !message.trim()) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Get Vapi credentials from environment variables
    const VAPI_API_KEY = process.env.VAPI_API_KEY;
    const ASSISTANT_ID = process.env.ASSISTANT_ID;
    const VAPI_CHAT_URL = process.env.VAPI_CHAT_URL;

    if (!VAPI_API_KEY || !ASSISTANT_ID || !VAPI_CHAT_URL) {
      console.error('❌ Missing Vapi environment variables');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Build Vapi API request payload
    const payload: any = {
      assistantId: ASSISTANT_ID,
      input: message,
    };

    // Add previousChatId only if it exist
    if (previous_chat_id) {
      payload.previousChatId = previous_chat_id;
    }

    console.log(`\n📤 Sending to Vapi: ${message.substring(0, 50)}...`);
    if (previous_chat_id) {
      console.log(`   (with previousChatId: ${previous_chat_id})`);
    }

    // Call Vapi API
    const vapiResponse = await fetch(VAPI_CHAT_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!vapiResponse.ok) {
      const errorText = await vapiResponse.text();
      console.error(`❌ Vapi API error: ${vapiResponse.status} - ${errorText}`);
      return NextResponse.json(
        { error: `Vapi API returned ${vapiResponse.status}` },
        { status: vapiResponse.status }
      );
    }

    const data: VapiResponse = await vapiResponse.json();

    // Extract chat_id
    const chat_id = data.id;

    // Find the assistant's response and function calls
    let assistant_response = '';
    let function_called: string | null = null;
    const output_array = data.output || [];

    // Search for tool_calls and final response
    for (const item of output_array) {
      if (item.role === 'assistant') {
        // Check for tool_calls
        if (item.tool_calls && item.tool_calls.length > 0) {
          for (const tool_call of item.tool_calls) {
            if (tool_call.function?.name) {
              function_called = tool_call.function.name;
              break;
            }
          }
        }

        // If has content, it's probably the final response
        if (item.content) {
          assistant_response = item.content;
        }
      }
    }

    // If no response found, search in reverse for safety
    if (!assistant_response) {
      for (let i = output_array.length - 1; i >= 0; i--) {
        const item = output_array[i];
        if (item.role === 'assistant' && item.content) {
          assistant_response = item.content;
          break;
        }
      }
    }

    // Map function names (same as Python code)
    const function_mapping: Record<string, string> = {
      'call_graph': 'GRAPH',
      'knowledge_base_new': 'RAG',
    };

    // Apply mapping if function exists in map, otherwise use original name
    if (function_called) {
      function_called = function_mapping[function_called] || function_called;
      console.log(`🔧 Function called: ${function_called}`);
    }

    console.log(`📥 Response: ${assistant_response.substring(0, 100)}...`);
    console.log(`💾 Chat ID: ${chat_id}`);

    // Create and return response JSON
    const response_json: ChatResponse = {
      chat_id,
      response: assistant_response,
      function_called,
    };

    return NextResponse.json(response_json);

  } catch (error) {
    console.error('❌ Error in Vapi chat endpoint:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
        chat_id: null,
        response: null,
        function_called: null
      },
      { status: 500 }
    );
  }
}
