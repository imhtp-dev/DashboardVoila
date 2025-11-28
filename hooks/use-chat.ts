import { useState, useEffect, useCallback, useRef } from 'react';
import { PipecatChatClient } from '@/lib/pipecat-chat-client';
import { VapiChatClient } from '@/lib/vapi-chat-client';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  functionCalled?: string | null;  // Raw function name from backend
}

export interface UseChatReturn {
  // Connection state
  isConnected: boolean;
  isTyping: boolean;
  sessionId: string | null;
  error: string | null;

  // Messages
  messages: Message[];
  currentChunk: string;

  // Actions
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sendMessage: (text: string) => void;
  clearMessages: () => void;
}

type ChatProvider = 'pipecat' | 'vapi';

/**
 * Universal chat hook that works with both Pipecat and Vapi
 * Provider is selected via NEXT_PUBLIC_CHAT_PROVIDER environment variable
 */
export function useChat(): UseChatReturn {
  // Get provider from environment (defaults to pipecat for backward compatibility)
  const provider: ChatProvider =
    (process.env.NEXT_PUBLIC_CHAT_PROVIDER as ChatProvider) || 'pipecat';

  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentChunk, setCurrentChunk] = useState('');

  const clientRef = useRef<PipecatChatClient | VapiChatClient | null>(null);
  const isConnectingRef = useRef(false);
  const currentFunctionCallsRef = useRef<string[]>([]);

  // Initialize client based on provider
  useEffect(() => {
    console.log(`🎯 Initializing chat with provider: ${provider}`);

    // Create appropriate client based on provider
    if (provider === 'vapi') {
      clientRef.current = new VapiChatClient();
    } else {
      clientRef.current = new PipecatChatClient();
    }

    // Set up event handlers (same for both providers)
    clientRef.current.on('connected', () => {
      console.log('✅ Chat client connected');
      setIsConnected(true);
      setError(null);
      isConnectingRef.current = false;
    });

    clientRef.current.on('disconnected', () => {
      console.log('🔌 Chat client disconnected');
      setIsConnected(false);
      isConnectingRef.current = false;
    });

    clientRef.current.on('typing', () => {
      setIsTyping(true);
    });

    clientRef.current.on('ready', () => {
      setIsTyping(false);
    });

    clientRef.current.on('chunk', (data: any) => {
      const text = data.text || data;
      setCurrentChunk((prev) => prev + text);
    });

    clientRef.current.on('function_called', (data: any) => {
      const functionName = data.function_name || data;
      currentFunctionCallsRef.current.push(functionName);
      console.log('🔧 Function tracked:', functionName);
    });

    clientRef.current.on('message', (data: any) => {
      const fullMessage = data.content || data.full_response || data.text || data;

      // Get the last non-routing function that was called
      const functionCalled = currentFunctionCallsRef.current.find(
        fn => !fn.includes('route_to')
      ) || currentFunctionCallsRef.current[0] || null;

      const assistantMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: fullMessage,
        timestamp: new Date(),
        functionCalled,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setCurrentChunk('');
      setIsTyping(false);

      // Reset function calls for next message
      currentFunctionCallsRef.current = [];
    });

    clientRef.current.on('error', (data: any) => {
      const err = data.error || data;
      console.error('❌ Chat error:', err);
      setError(typeof err === 'string' ? err : err.message);
      setIsTyping(false);
      setCurrentChunk('');
    });

    // Cleanup ONLY on unmount or provider change
    return () => {
      if (clientRef.current) {
        console.log('🧹 Cleaning up chat client');
        clientRef.current.disconnect();
      }
    };
  }, [provider]); // Only re-run if provider changes

  /**
   * Connect to chat service
   */
  const connect = useCallback(async () => {
    if (!clientRef.current || isConnectingRef.current || isConnected) {
      return;
    }

    try {
      isConnectingRef.current = true;
      setError(null);

      // Pipecat needs session creation, Vapi doesn't
      if (provider === 'pipecat' && 'createSession' in clientRef.current) {
        const newSessionId = await (clientRef.current as PipecatChatClient).createSession();
        setSessionId(newSessionId);
      }

      // Connect
      await clientRef.current.connect();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect';
      setError(errorMessage);
      setIsConnected(false);
      isConnectingRef.current = false;
    }
  }, [isConnected, provider]);

  /**
   * Disconnect from chat service
   */
  const disconnect = useCallback(async () => {
    if (!clientRef.current) {
      return;
    }

    try {
      await clientRef.current.disconnect();
      setIsConnected(false);
      setSessionId(null);
      setMessages([]);
      setCurrentChunk('');
      setIsTyping(false);
      setError(null);
    } catch (err) {
      console.error('Error disconnecting:', err);
    }
  }, []);

  /**
   * Send a message
   */
  const sendMessage = useCallback((text: string) => {
    console.log('📨 sendMessage called', {
      hasClient: !!clientRef.current,
      isConnected,
      hasText: !!text.trim(),
      provider
    });

    if (!clientRef.current || !isConnected || !text.trim()) {
      console.warn('⚠️ Cannot send message - preconditions not met');
      return;
    }

    try {
      // Add user message to UI immediately
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: text,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);

      // Send to chat service
      clientRef.current.sendMessage(text);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      console.error('❌ Error sending message:', errorMessage);
      setError(errorMessage);
    }
  }, [isConnected, provider]);

  /**
   * Clear all messages
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
    setCurrentChunk('');

    // Clear conversation on Vapi
    if (provider === 'vapi' && clientRef.current && 'clearConversation' in clientRef.current) {
      (clientRef.current as VapiChatClient).clearConversation();
    }
  }, [provider]);

  return {
    // Connection state
    isConnected,
    isTyping,
    sessionId,
    error,

    // Messages
    messages,
    currentChunk,

    // Actions
    connect,
    disconnect,
    sendMessage,
    clearMessages,
  };
}

// Export old name for backward compatibility during migration
export const usePipecatChat = useChat;
