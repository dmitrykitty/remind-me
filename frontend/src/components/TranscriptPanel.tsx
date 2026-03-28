import { useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface TranscriptMessage {
  id: string;
  role: "user" | "system" | "volunteer";
  text: string;
  timestamp: number;
}

interface TranscriptPanelProps {
  visible: boolean;
  messages: TranscriptMessage[];
  isRecording: boolean;
  isProcessing: boolean;
  isVolunteerCall: boolean;
}

export default function TranscriptPanel({
  visible,
  messages,
  isRecording,
  isProcessing,
  isVolunteerCall,
}: TranscriptPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const formatTime = useCallback((ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          className="absolute top-16 right-3 bottom-24 w-72 z-40 flex flex-col"
        >
          <div className="flex-1 glass rounded-2xl flex flex-col overflow-hidden border border-white/10">
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
              {isRecording && (
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              )}
              {isProcessing && (
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
              )}
              {isVolunteerCall && !isRecording && !isProcessing && (
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              )}
              <span className="text-white/80 text-sm font-medium">
                {isVolunteerCall ? "Rozmowa" : "Transkrypt"}
              </span>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto hide-scrollbar px-3 py-2 space-y-2"
            >
              {messages.length === 0 && (
                <div className="text-white/25 text-xs text-center py-8">
                  {isRecording
                    ? "Mów polecenie..."
                    : isVolunteerCall
                      ? "Czekanie na rozmowę..."
                      : "Brak wiadomości"}
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`max-w-[90%] px-3 py-2 rounded-xl text-sm ${
                      msg.role === "user"
                        ? "bg-blue-500/20 text-blue-200 rounded-br-sm"
                        : msg.role === "volunteer"
                          ? "bg-emerald-500/20 text-emerald-200 rounded-bl-sm"
                          : "bg-white/10 text-white/60 rounded-bl-sm"
                    }`}
                  >
                    {msg.text}
                  </div>
                  <span className="text-white/20 text-[10px] mt-0.5 px-1">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
              ))}

              {/* Typing indicator */}
              {isProcessing && (
                <div className="flex items-start">
                  <div className="bg-white/10 px-3 py-2 rounded-xl rounded-bl-sm flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" />
                    <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:0.15s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:0.3s]" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
