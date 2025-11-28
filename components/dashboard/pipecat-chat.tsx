"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Send, Bot, User, Sparkles, Database, Network, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChat } from "@/hooks/use-chat";

// Badge configuration for different function types
// Maps actual backend function names to display labels and styles
const BADGE_CONFIG: Record<string, { label: string; className: string; icon: any }> = {
  knowledge_base_lombardia: {
    label: 'RAG',
    className: 'bg-purple-50 text-purple-700 border-purple-200',
    icon: Database
  },
  get_price_agonistic_visit_lombardia: {
    label: 'Agonistic Pricing',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: Network
  },
  get_price_non_agonistic_visit_lombardia: {
    label: 'Non-Agonistic Pricing',
    className: 'bg-orange-50 text-orange-700 border-orange-200',
    icon: Network
  },
  get_exam_by_visit_lombardia: {
    label: 'Get exams visit',
    className: 'bg-teal-50 text-teal-700 border-teal-200',
    icon: Network
  },
  get_exam_by_sport_lombardia: {
    label: 'Get-Exams By Sport',
    className: 'bg-green-50 text-green-700 border-green-200',
    icon: Network
  },
  get_clinic_info_lombardia: {
    label: 'Clinic Info',
    className: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    icon: Network
  },
  // Legacy function names (keep for backward compatibility)
  get_competitive_pricing: {
    label: 'Competitive pricing',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: Network
  },
  get_non_competitive_pricing: {
    label: 'Non-Competitive pricing',
    className: 'bg-orange-50 text-orange-700 border-orange-200',
    icon: Network
  },
  get_exam_by_visit: {
    label: 'Get exams visit',
    className: 'bg-teal-50 text-teal-700 border-teal-200',
    icon: Network
  },
  get_exam_by_sport: {
    label: 'Get exams sport',
    className: 'bg-green-50 text-green-700 border-green-200',
    icon: Network
  },
  get_clinic_info: {
    label: 'Clinic info',
    className: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    icon: Network
  },
  call_graph_lombardia: {
    label: 'Graph Query',
    className: 'bg-green-50 text-green-700 border-green-200',
    icon: Network
  },
  graph_lombardia: {
    label: 'Graph Query',
    className: 'bg-green-50 text-green-700 border-green-200',
    icon: Network
  },
  // Vapi function names (exact names returned by Vapi backend)
  get_list_exam_by_sport: {
    label: 'Get Exams By Sport',
    className: 'bg-green-50 text-green-700 border-green-200',
    icon: Network
  },
  get_list_exam_by_visit: {
    label: 'Get Exams By Visit',
    className: 'bg-teal-50 text-teal-700 border-teal-200',
    icon: Network
  },
  get_price_agonistic_visit: {
    label: 'Agonistic Pricing',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: Network
  },
  GRAPH: {
    label: 'GRAPH',
    className: 'bg-green-50 text-green-700 border-green-200',
    icon: Network
  },
  RAG: {
    label: 'RAG',
    className: 'bg-purple-50 text-purple-700 border-purple-200',
    icon: Database
  }
};

/**
 * Get badge configuration for a given function name
 * Returns default gray badge if function name not recognized
 */
function getBadgeConfig(functionName: string) {
  return BADGE_CONFIG[functionName] || {
    label: functionName, // Fallback to raw function name
    className: 'bg-gray-50 text-gray-700 border-gray-200',
    icon: AlertCircle
  };
}

interface PipecatChatProps {
  onConnectionChange?: (connected: boolean) => void;
}

export function PipecatChat({ onConnectionChange }: PipecatChatProps) {
  const [inputMessage, setInputMessage] = useState("");
  const [charCount, setCharCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const maxChars = 1000;

  const {
    isConnected,
    isTyping,
    sessionId,
    error,
    messages,
    currentChunk,
    connect,
    disconnect,
    sendMessage,
  } = useChat();

  // Auto-connect on mount
  useEffect(() => {
    let isMounted = true;

    const attemptConnect = async () => {
      try {
        if (isMounted) {
          await connect();
        }
      } catch (err) {
        console.error('Failed to auto-connect:', err);
      }
    };

    attemptConnect();

    // Cleanup on unmount
    return () => {
      isMounted = false;
      // Don't disconnect - let the hook handle cleanup
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - run only once on mount

  // Update connection status when it changes
  useEffect(() => {
    if (onConnectionChange) {
      onConnectionChange(isConnected);
    }
  }, [isConnected, onConnectionChange]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentChunk]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !isConnected) return;

    sendMessage(inputMessage);
    setInputMessage("");
    setCharCount(0);
    inputRef.current?.focus();
  };

  return (
    <Card className="flex flex-col border-2 border-blue-400 shadow-lg overflow-hidden" style={{ height: '700px' }}>
      <CardHeader className="border-b bg-gradient-to-r from-blue-50/50 to-white flex-shrink-0 py-4">
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            Chat Voilà con Streaming
          </div>
          {sessionId && (
            <Badge variant="outline" className="text-xs font-mono">
              {sessionId.substring(0, 8)}...
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      {/* Error Alert */}
      {error && (
        <div className="p-4 pb-0 flex-shrink-0">
          <Alert variant="destructive" className="animate-in slide-in-from-top">
            <div className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <AlertDescription className="whitespace-nowrap overflow-hidden text-ellipsis">
                  {error}
                </AlertDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => connect()}
                className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white border-blue-600 hover:border-blue-700 shadow-md hover:shadow-lg hover:scale-105 transition-all"
              >
                Collegare
              </Button>
            </div>
          </Alert>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50/30" style={{ minHeight: 0 }}>
        {messages.length === 0 && !currentChunk ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-sm">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center">
                <Bot className="h-10 w-10 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                {isConnected ? "Inizia una conversazione" : "Connessione in corso..."}
              </h3>
              <p className="text-sm text-muted-foreground">
                {isConnected
                  ? "Fai una domanda per testare la conoscenza del voice agent con streaming in tempo reale"
                  : "Attendere la connessione al servizio Pipecat..."}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 max-w-4xl mx-auto">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === "user" ? "justify-end" : "justify-start"
                } animate-in slide-in-from-bottom duration-300`}
              >
                {message.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Bot className="h-5 w-5 text-white" />
                  </div>
                )}
                <div className="flex flex-col max-w-[75%]">
                  <div
                    className={`rounded-2xl px-4 py-3 ${
                      message.role === "user"
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-white text-gray-900 shadow-sm border border-gray-100"
                    }`}
                  >
                    <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                      {message.content}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-1 px-2">
                    <p className="text-xs text-muted-foreground">
                      {message.timestamp.toLocaleTimeString("it-IT", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    {message.functionCalled && (() => {
                      const config = getBadgeConfig(message.functionCalled);
                      const Icon = config.icon;
                      return (
                        <Badge
                          variant="outline"
                          className={`text-xs gap-1 ${config.className}`}
                        >
                          <Icon className="h-3 w-3" />
                          {config.label}
                        </Badge>
                      );
                    })()}
                  </div>
                </div>
                {message.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                    <User className="h-5 w-5 text-white" />
                  </div>
                )}
              </div>
            ))}

            {/* Streaming Message with Blinking Cursor */}
            {currentChunk && (
              <div className="flex gap-3 justify-start animate-in slide-in-from-bottom duration-300">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Bot className="h-5 w-5 text-white" />
                </div>
                <div className="flex flex-col max-w-[75%]">
                  <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100">
                    <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                      {currentChunk}
                      <span className="inline-block w-2 h-4 ml-1 bg-blue-600 animate-pulse" />
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Typing Indicator - Modern Animated Dots */}
            {isTyping && !currentChunk && (
              <div className="flex gap-3 justify-start animate-in slide-in-from-bottom duration-300">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Bot className="h-5 w-5 text-white" />
                </div>
                <div className="bg-white rounded-2xl px-6 py-4 shadow-sm border border-gray-100">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-2.5 h-2.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-2.5 h-2.5 bg-blue-600 rounded-full animate-bounce"></div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t bg-gradient-to-r from-blue-50/30 to-white p-4 flex-shrink-0">
        <form onSubmit={handleSendMessage} className="space-y-2">
          <div className="flex gap-3">
            <Input
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => {
                setInputMessage(e.target.value);
                setCharCount(e.target.value.length);
              }}
              placeholder={isConnected ? "Scrivi un messaggio..." : "Connessione in corso..."}
              disabled={!isConnected}
              maxLength={maxChars}
              className="flex-1 bg-blue-50/50 border-2 border-blue-200 hover:border-blue-400 focus:border-blue-500 focus:bg-white transition-all h-11"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
            />
            <Button
              type="submit"
              disabled={!isConnected || !inputMessage.trim()}
              className="gap-2 px-6 h-11 bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              <Send className="h-4 w-4" />
              <span>Invia</span>
            </Button>
          </div>
          <div className="flex items-center justify-between px-1">
            <p className="text-xs text-muted-foreground">
              Premi Invio per inviare • Shift+Invio per andare a capo
            </p>
            <p
              className={`text-xs font-medium ${
                charCount > 800
                  ? "text-red-600"
                  : charCount > 600
                  ? "text-yellow-600"
                  : "text-muted-foreground"
              }`}
            >
              {charCount}/{maxChars}
            </p>
          </div>
        </form>
      </div>
    </Card>
  );
}
