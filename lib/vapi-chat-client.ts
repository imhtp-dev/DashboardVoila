/**
 * Vapi Chat Client
 * REST API-based client for chat with Vapi assistant
 * Implements same interface as PipecatChatClient for seamless swapping
 */

export interface VapiMessage {
  chat_id: string;
  response: string;
  function_called: string | null;
}

export type VapiEventType = 'connected' | 'disconnected' | 'typing' | 'chunk' | 'message' | 'error';

export class VapiChatClient {
  private chatId: string | null = null;
  private isConnected: boolean = false;
  private eventHandlers: Map<VapiEventType, Function[]> = new Map();

  /**
   * Register an event handler
   */
  on(event: VapiEventType, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  /**
   * Unregister an event handler
   */
  off(event: VapiEventType, handler: Function): void {
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
  private emit(event: VapiEventType, data?: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }

  /**
   * Connect (no actual connection needed for REST API)
   */
  async connect(): Promise<void> {
    console.log('🔌 Vapi client connecting...');
    this.isConnected = true;
    this.emit('connected');
    console.log('✅ Vapi client connected (ready to send messages)');
  }

  /**
   * Disconnect
   */
  async disconnect(): Promise<void> {
    console.log('🔌 Vapi client disconnecting...');
    this.isConnected = false;
    this.chatId = null; // Clear chat ID on disconnect
    this.emit('disconnected');
    console.log('✅ Vapi client disconnected');
  }

  /**
   * Send a message to Vapi
   */
  async sendMessage(text: string): Promise<void> {
    if (!this.isConnected) {
      console.error('❌ Cannot send message: Not connected');
      throw new Error('Not connected');
    }

    if (!text.trim()) {
      console.warn('⚠️ Cannot send empty message');
      return;
    }

    console.log('📤 Sending message to Vapi:', text.substring(0, 50) + '...');
    console.log('💾 Previous chat_id:', this.chatId || 'null (new conversation)');

    // Emit typing event
    this.emit('typing');

    try {
      // Call the internal Next.js API route
      const response = await fetch('/api/vapi-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: text,
          previous_chat_id: this.chatId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Backend returned ${response.status}: ${errorText}`);
      }

      const data: VapiMessage = await response.json();
      console.log('📥 Received response from Vapi');
      console.log('💾 New chat_id:', data.chat_id);
      console.log('📝 Response length:', data.response.length, 'chars');
      console.log('🔧 Function called:', data.function_called || 'none');

      // Store chat_id for conversation continuity
      this.chatId = data.chat_id;

      // Simulate streaming for consistent UX
      this.simulateStreaming(data.response, data.function_called);

    } catch (error) {
      console.error('❌ Error sending message to Vapi:', error);
      this.emit('error', {
        error: error instanceof Error ? error.message : 'Failed to send message'
      });
      throw error;
    }
  }

  /**
   * Simulate streaming by breaking response into words
   * Emits chunk events with delay for visual typing effect
   */
  private simulateStreaming(fullText: string, functionCalled: string | null): void {
    const words = fullText.split(' ');
    let accumulatedText = '';

    console.log(`🎬 Simulating streaming for ${words.length} words`);

    words.forEach((word, index) => {
      setTimeout(() => {
        accumulatedText += (index === 0 ? '' : ' ') + word;

        // Emit chunk event for each word
        this.emit('chunk', {
          type: 'assistant_message_chunk',
          text: word,
        });

        // On last word, emit complete message
        if (index === words.length - 1) {
          console.log('✅ Streaming complete');

          // Emit function_called event BEFORE the complete message (like Pipecat does)
          if (functionCalled) {
            console.log('🔧 Emitting function_called event:', functionCalled);
            this.emit('function_called', functionCalled);
          }

          // Then emit the complete message
          this.emit('message', {
            type: 'assistant_message_complete',
            content: fullText,
            full_response: fullText,
            text: fullText,
          });
        }
      }, index * 50); // 50ms delay between words for smooth typing effect
    });
  }

  /**
   * Clear conversation (reset chat_id)
   */
  clearConversation(): void {
    console.log('🗑️ Clearing Vapi conversation');
    this.chatId = null;
  }

  /**
   * Get connection status
   */
  get connected(): boolean {
    return this.isConnected;
  }

  /**
   * Get current chat ID
   */
  get sessionId(): string | null {
    return this.chatId;
  }
}
