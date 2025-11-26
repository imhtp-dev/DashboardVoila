"use client";

import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Database, Network } from "lucide-react";
import { cn } from "@/lib/utils";
import { PipecatChat } from "@/components/dashboard/pipecat-chat";

export default function VerificaConoscenzaPage() {
  const [isPipecatConnected, setIsPipecatConnected] = useState(false);

  // Stats from Pipecat chat
  const [chatStats, setChatStats] = useState({
    messages: 0,
    ragCalls: 0,
    graphCalls: 0,
  });

  // Handle stats update from Pipecat chat
  const handleStatsUpdate = useCallback((stats: { messages: number; ragCalls: number; graphCalls: number }) => {
    setChatStats(stats);
  }, []);

  // Handle connection change from Pipecat chat
  const handleConnectionChange = useCallback((connected: boolean) => {
    setIsPipecatConnected(connected);
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
              Voilà Chat
            </h1>
            <p className="text-base text-gray-600">
              Testa la conoscenza dell agent tramite chat testuale con streaming in tempo reale
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Pipecat Chat Status */}
            <div className="relative">
              <div className={cn(
                "absolute inset-0 rounded-full blur-md opacity-20 animate-pulse",
                isPipecatConnected ? "bg-green-500" : "bg-gray-500"
              )}></div>
              <Badge
                variant="outline"
                className={cn(
                  "relative gap-2 px-4 py-1.5 backdrop-blur-sm",
                  isPipecatConnected
                    ? "border-green-200 bg-green-50/50 text-green-700"
                    : "border-gray-200 bg-gray-50/50 text-gray-700"
                )}
              >
                <span className="relative flex h-2 w-2">
                  {isPipecatConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
                  <span className={cn(
                    "relative inline-flex rounded-full h-2 w-2",
                    isPipecatConnected ? "bg-green-500" : "bg-gray-500"
                  )}></span>
                </span>
                Chat Voilà {isPipecatConnected ? "Connesso" : "Disconnesso"}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Voilà Interface */}
      <PipecatChat
        onStatsUpdate={handleStatsUpdate}
        onConnectionChange={handleConnectionChange}
      />
    </div>
  );
}
