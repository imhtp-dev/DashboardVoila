import { useState, useEffect, useCallback, useRef } from 'react';
import PipecatChatClient from '@/lib/pipecat-chat-client';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  functionCalled?: string | null;  // Raw function name from backend
}

export interface UsePipecatChatReturn {
  // Connection state
  isConnected: boolean;
  isTyping: boolean;
  sessionId: string | null;
  error: string | null;

  // Messages
  messages: Message[];
  currentChunk: string;

  // Stats
  ragCallsCount: number;
  graphCallsCount: number;
  totalMessagesCount: number;

  // Actions
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sendMessage: (text: string) => void;
  clearMessages: () => void;
}

/**
 * Check if a function name belongs to the GRAPH category
 */
const isGraphFunction = (functionName: string): boolean => {
  const graphFunctions = [
    'get_competitive_pricing',
    'get_non_competitive_pricing',
    'get_exam_by_visit',
    'get_exam_by_sport',
    'get_clinic_info',
    'call_graph_lombardia',
    'graph_lombardia'
  ];
  return graphFunctions.some(fn => functionName.includes(fn));
};

export function usePipecatChat(): UsePipecatChatReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentChunk, setCurrentChunk] = useState('');
  const [ragCallsCount, setRagCallsCount] = useState(0);
  const [graphCallsCount, setGraphCallsCount] = useState(0);

  const clientRef = useRef<PipecatChatClient | null>(null);
  const isConnectingRef = useRef(false);
  const currentFunctionCallsRef = useRef<string[]>([]);

  // Initialize client
  useEffect(() => {
    clientRef.current = new PipecatChatClient();

    // Set up event handlers
    clientRef.current.on('connected', () => {
      setIsConnected(true);
      setError(null);
      isConnectingRef.current = false;
    });

    clientRef.current.on('disconnected', () => {
      setIsConnected(false);
      isConnectingRef.current = false;
    });

    clientRef.current.on('typing', () => {
      setIsTyping(true);
    });

    clientRef.current.on('ready', () => {
      setIsTyping(false);
    });

    clientRef.current.on('chunk', (text: string) => {
      setCurrentChunk((prev) => prev + text);
    });

    clientRef.current.on('function_called', (functionName: string) => {
      // Track function calls for the current message
      currentFunctionCallsRef.current.push(functionName);
      console.log('📊 Function tracked:', functionName, 'Total:', currentFunctionCallsRef.current);
    });

    clientRef.current.on('message', (fullMessage: string) => {
      // Skip routing functions and get the actual function that was called
      // Backend sends route_to_info or route_to_booking first, then the actual function
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

      // Update stats based on function type
      if (functionCalled === 'knowledge_base_lombardia') {
        setRagCallsCount((prev) => prev + 1);
      } else if (functionCalled && isGraphFunction(functionCalled)) {
        setGraphCallsCount((prev) => prev + 1);
      }

      // Reset function calls for next message
      currentFunctionCallsRef.current = [];
    });

    clientRef.current.on('error', (err: Error) => {
      console.error('Pipecat error:', err);
      setError(err.message);
      setIsTyping(false);
      setCurrentChunk('');
    });

    // Cleanup on unmount
    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
      }
    };
  }, []);



  /**
   * Connect to Pipecat service
   */
  const connect = useCallback(async () => {
    if (!clientRef.current || isConnectingRef.current || isConnected) {
      return;
    }

    try {
      isConnectingRef.current = true;
      setError(null);

      // Create session
      const newSessionId = await clientRef.current.createSession();
      setSessionId(newSessionId);

      // Connect WebSocket
      await clientRef.current.connect();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect';
      setError(errorMessage);
      setIsConnected(false);
      isConnectingRef.current = false;
    }
  }, [isConnected]);

  /**
   * Disconnect from Pipecat service
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
      setRagCallsCount(0);
      setGraphCallsCount(0);
      setError(null);
    } catch (err) {
      console.error('Error disconnecting:', err);
    }
  }, []);

  /**
   * Send a message
   */
  const sendMessage = useCallback((text: string) => {
    if (!clientRef.current || !isConnected || !text.trim()) {
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

      // Send to Pipecat
      clientRef.current.sendMessage(text);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);
    }
  }, [isConnected]);

  /**
   * Clear all messages
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
    setCurrentChunk('');
    setRagCallsCount(0);
    setGraphCallsCount(0);
  }, []);

  return {
    // Connection state
    isConnected,
    isTyping,
    sessionId,
    error,

    // Messages
    messages,
    currentChunk,

    // Stats
    ragCallsCount,
    graphCallsCount,
    totalMessagesCount: messages.length,

    // Actions
    connect,
    disconnect,
    sendMessage,
    clearMessages,
  };
}
