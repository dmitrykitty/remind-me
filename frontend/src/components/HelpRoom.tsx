import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

type SessionState = "idle" | "connecting" | "active" | "error";

interface HelpRoomProps {
  onClose: () => void;
}

export default function HelpRoom({ onClose }: HelpRoomProps) {
  const [state, setState] = useState<SessionState>("idle");
  const [error, setError] = useState<string>("");
  const [elapsed, setElapsed] = useState(0);
  const roomIdRef = useRef<string | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Timer for elapsed seconds
  useEffect(() => {
    if (state === "active") {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state]);

  const startSession = useCallback(async () => {
    setState("connecting");
    setError("");
    try {
      const resp = await fetch("/api/agent/start-help", { method: "POST" });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({ detail: resp.statusText }));
        throw new Error(body.detail || "Failed to start session");
      }
      const data = await resp.json();
      roomIdRef.current = data.room_id;
      setState("active");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  }, []);

  const stopSession = useCallback(async () => {
    if (roomIdRef.current) {
      await fetch("/api/agent/stop-help", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_id: roomIdRef.current }),
      }).catch(() => {});
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    roomIdRef.current = null;
    setState("idle");
    onClose();
  }, [onClose]);

  // Auto-start on mount
  useEffect(() => {
    startSession();
    return () => {
      // Cleanup on unmount
      if (roomIdRef.current) {
        fetch("/api/agent/stop-help", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ room_id: roomIdRef.current }),
        }).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-80 glass rounded-3xl p-8 flex flex-col items-center gap-6"
      >
        {/* Header */}
        <div className="text-center">
          <div className="text-4xl mb-2">🆘</div>
          <h2 className="text-xl font-bold text-white">Asystent AI</h2>
          <p className="text-white/60 text-sm mt-1">
            {state === "connecting" && "Łączenie z asystentem..."}
            {state === "active" && "Rozmowa aktywna"}
            {state === "error" && "Nie udało się połączyć"}
            {state === "idle" && "Gotowy do połączenia"}
          </p>
        </div>

        {/* Audio visualiser / status */}
        <div className="relative w-32 h-32 flex items-center justify-center">
          {state === "connecting" && (
            <div className="w-20 h-20 rounded-full border-4 border-amber-400/40 border-t-amber-400 animate-spin" />
          )}
          {state === "active" && (
            <>
              <div className="absolute w-32 h-32 rounded-full bg-emerald-400/10 animate-pulse" />
              <div className="absolute w-24 h-24 rounded-full bg-emerald-400/20 animate-pulse [animation-delay:0.3s]" />
              <div className="w-16 h-16 rounded-full bg-emerald-400/30 flex items-center justify-center">
                <span className="text-3xl">🎙️</span>
              </div>
            </>
          )}
          {state === "error" && (
            <div className="w-20 h-20 rounded-full bg-red-400/20 flex items-center justify-center">
              <span className="text-3xl">❌</span>
            </div>
          )}
        </div>

        {/* Timer */}
        <AnimatePresence>
          {state === "active" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-2xl font-mono text-white/80"
            >
              {formatTime(elapsed)}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error message */}
        {state === "error" && error && (
          <p className="text-red-300 text-sm text-center">{error}</p>
        )}

        {/* Actions */}
        <div className="flex gap-4">
          {state === "error" && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={startSession}
              className="px-6 py-3 rounded-full bg-amber-500 text-black font-semibold"
            >
              Spróbuj ponownie
            </motion.button>
          )}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={stopSession}
            className={`px-6 py-3 rounded-full font-semibold ${
              state === "active"
                ? "bg-red-500 text-white"
                : "bg-white/10 text-white/70"
            }`}
          >
            {state === "active" ? "Zakończ rozmowę" : "Zamknij"}
          </motion.button>
        </div>

        {/* Hidden audio element for remote audio playback */}
        <audio ref={audioRef} autoPlay playsInline className="hidden" />
      </motion.div>
    </motion.div>
  );
}
