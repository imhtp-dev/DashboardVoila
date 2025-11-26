/**
 * Pipecat Chat Client
 * WebSocket-based client for real-time streaming chat with the Pipecat service
 */

export interface PipecatMessage {
  type: 'status' | 'chunk' | 'complete' | 'error' | 'assistant_message_chunk' | 'assistant_message_complete' | 'connected' | 'function_called';
  status?: 'connected' | 'typing' | 'ready';
  content?: string;
  text?: string;  // Backend uses 'text' instead of 'content'
  full_response?: string;
  error?: string;
  session_id?: string;
  timestamp?: string;
  connections?: number;
  function_name?: string;  // Function that was called (e.g., "knowledge_base_lombardia")
}

export interface PipecatSession {
  session_id: string;
  websocket_url: string;
  created_at: string;
  status: string;
}

export type PipecatEventType = 'connected' | 'disconnected' | 'typing' | 'ready' | 'chunk' | 'message' | 'error' | 'function_called';

export class PipecatChatClient {
  private apiBaseUrl: string;
  private wsBaseUrl: string;
  private sessionId: string | null = null;
  private ws: WebSocket | null = null;
  private isConnected: boolean = false;
  private eventHandlers: Map<PipecatEventType, Function[]> = new Map();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 3;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Get URLs from environment variables
    this.apiBaseUrl = process.env.NEXT_PUBLIC_PIPECAT_CHAT_API_URL || 'http://localhost:8002/api';
    this.wsBaseUrl = process.env.NEXT_PUBLIC_PIPECAT_CHAT_WS_URL || 'ws://localhost:8002/ws';
  }

  /**
   * Register an event handler
   */
  on(event: PipecatEventType, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  /**
   * Unregister an event handler
   */
  off(event: PipecatEventType, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Emit an event
   */
  private emit(event: PipecatEventType, ...args: any[]): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(...args));
    }
  }

  /**
   * Create a new chat session
   */
  async createSession(userId?: string, metadata?: Record<string, any>): Promise<string> {
    try {
      // Get auth token from localStorage
      const authToken = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

      const response = await fetch(`${this.apiBaseUrl}/create-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          user_id: userId,
          metadata: {
            ...metadata,
            auth_token: authToken,
            region: 'Piemonte', // Hardcoded as per requirements
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Failed to create session: ${response.status}`);
      }

      const data: PipecatSession = await response.json();
      this.sessionId = data.session_id;

      console.log('✅ Pipecat session created:', this.sessionId);
      return this.sessionId;
    } catch (error) {
      console.error('❌ Failed to create Pipecat session:', error);
      throw error;
    }
  }

  /**
   * Connect to WebSocket
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.sessionId) {
        reject(new Error('No session ID. Call createSession() first.'));
        return;
      }

      if (this.isConnected) {
        resolve();
        return;
      }

      try {
        // Build WebSocket URL - backend uses fixed session ID, no need to pass it
        // The /ws endpoint doesn't accept session_id in the path
        const wsUrl = this.wsBaseUrl;

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          console.log('✅ Pipecat WebSocket connected');
          this.emit('connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: PipecatMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('❌ Failed to parse Pipecat message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('❌ Pipecat WebSocket error:', error);
          this.emit('error', error);
          reject(error);
        };

        this.ws.onclose = () => {
          this.isConnected = false;
          console.log('🔌 Pipecat WebSocket disconnected');
          this.emit('disconnected');

          // Attempt reconnection if within retry limit
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.attemptReconnect();
          }
        };
      } catch (error) {
        console.error('❌ Failed to connect Pipecat WebSocket:', error);
        reject(error);
      }
    });
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 10000);

    console.log(`🔄 Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms...`);

    this.reconnectTimeout = setTimeout(() => {
      this.connect().catch(err => {
        console.error('❌ Reconnect failed:', err);
      });
    }, delay);
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(message: PipecatMessage): void {
    console.log('📨 Received Pipecat message:', message);

    switch (message.type) {
      case 'connected':
        console.log('🔗 WebSocket connected:', message.session_id, 'connections:', message.connections);
        // Connection confirmation - no action needed
        break;

      case 'status':
        console.log('📊 Status update:', message.status);
        if (message.status === 'typing') {
          this.emit('typing');
        } else if (message.status === 'ready') {
          this.emit('ready');
        }
        break;

      case 'chunk':
      case 'assistant_message_chunk':
        // Real-time streaming chunk - backend sends 'text' field
        const chunkText = message.text || message.content;
        console.log('📝 Chunk received:', chunkText);
        if (chunkText) {
          this.emit('chunk', chunkText);
        }
        break;

      case 'complete':
      case 'assistant_message_complete':
        // Full response received - check all possible fields
        const fullMessage = message.text || message.full_response || message.content;
        console.log('✅ Complete message:', fullMessage);
        if (fullMessage) {
          this.emit('message', fullMessage);
        }
        break;

      case 'function_called':
        console.log('🔧 Function called:', message.function_name);
        if (message.function_name) {
          this.emit('function_called', message.function_name);
        }
        break;

      case 'error':
        console.error('❌ Pipecat error:', message.error);
        this.emit('error', new Error(message.error || 'Unknown error'));
        break;

      default:
        console.warn('⚠️ Unknown Pipecat message type:', message.type);
    }
  }

  /**
   * Send a message to the AI
   */
  sendMessage(text: string): void {
    if (!this.isConnected || !this.ws) {
      throw new Error('WebSocket not connected');
    }

    if (this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not ready');
    }

    this.ws.send(JSON.stringify({ message: text }));
  }

  /**
   * Get session information
   */
  async getSessionInfo(): Promise<any> {
    if (!this.sessionId) {
      throw new Error('No active session');
    }

    const response = await fetch(`${this.apiBaseUrl}/session/${this.sessionId}/info`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get session info: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Disconnect and cleanup
   */
  async disconnect(): Promise<void> {
    // Clear reconnect timeout first to prevent reconnection
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Stop reconnection attempts by setting to max
    this.reconnectAttempts = this.maxReconnectAttempts;

    // Store session ID before closing WebSocket
    const sessionToDelete = this.sessionId;

    // Close WebSocket - this will trigger onclose event
    if (this.ws) {
      try {
        // Remove event handlers to prevent reconnection
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.onmessage = null;
        this.ws.onopen = null;

        this.ws.close();
      } catch (error) {
        console.error('Error closing WebSocket:', error);
      }
      this.ws = null;
    }

    // Reset state immediately
    this.sessionId = null;
    this.isConnected = false;

    // Delete session from backend (only if we have a session ID)
    if (sessionToDelete) {
      try {
        const response = await fetch(`${this.apiBaseUrl}/session/${sessionToDelete}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          console.log('✅ Pipecat session deleted:', sessionToDelete);
        } else if (response.status === 404) {
          // Session already deleted, this is fine
          console.log('ℹ️ Pipecat session already deleted:', sessionToDelete);
        } else {
          console.warn('⚠️ Failed to delete Pipecat session:', response.status);
        }
      } catch (error) {
        console.error('⚠️ Error deleting Pipecat session:', error);
      }
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  /**
   * Get session ID
   */
  getSessionId(): string | null {
    return this.sessionId;
  }
}

export default PipecatChatClient;
