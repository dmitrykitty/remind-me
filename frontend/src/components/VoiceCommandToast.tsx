import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";

interface VoiceCommandToastProps {
  isRecording: boolean;
  isProcessing: boolean;
  result: {
    success: boolean;
    intent?: string;
    message?: string;
    error?: string;
    transcript?: string;
  } | null;
  onDismiss: () => void;
}

export default function VoiceCommandToast({
  isRecording,
  isProcessing,
  result,
  onDismiss,
}: VoiceCommandToastProps) {
  // Auto-dismiss result after 4 seconds
  useEffect(() => {
    if (result && !isRecording && !isProcessing) {
      const t = setTimeout(onDismiss, 4000);
      return () => clearTimeout(t);
    }
  }, [result, isRecording, isProcessing, onDismiss]);

  const show = isRecording || isProcessing || result;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.25 }}
          className="absolute bottom-28 left-1/2 -translate-x-1/2 z-40 max-w-[85vw]"
        >
          {isRecording && (
            <div className="glass rounded-2xl px-5 py-3 flex items-center gap-3 border border-red-400/40">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
              <span className="text-white text-sm font-medium">
                Listening… speak your command
              </span>
            </div>
          )}

          {!isRecording && isProcessing && (
            <div className="glass rounded-2xl px-5 py-3 flex items-center gap-3 border border-amber-400/40">
              <span className="w-3 h-3 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-white text-sm font-medium">
                Processing voice command…
              </span>
            </div>
          )}

          {!isRecording && !isProcessing && result && (
            <button
              onClick={onDismiss}
              className="glass rounded-2xl px-5 py-3 flex items-center gap-3 text-left border"
              style={{
                borderColor: result.success
                  ? "rgba(52, 211, 153, 0.4)"
                  : "rgba(248, 113, 113, 0.4)",
              }}
            >
              <span
                className={`text-xl shrink-0 ${result.success ? "" : ""}`}
              >
                {result.success ? "✓" : "✗"}
              </span>
              <div className="flex flex-col">
                <span
                  className={`text-sm font-semibold ${
                    result.success ? "text-emerald-300" : "text-red-300"
                  }`}
                >
                  {result.success
                    ? result.message || "Done"
                    : result.error || "Error"}
                </span>
                {result.transcript && (
                  <span className="text-white/40 text-xs mt-0.5 line-clamp-2">
                    "{result.transcript}"
                  </span>
                )}
              </div>
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
