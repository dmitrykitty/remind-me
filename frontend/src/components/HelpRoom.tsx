import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useConnection,
  useCamera,
  useMicrophone,
  usePeers,
  useInitializeDevices,
} from "@fishjam-cloud/react-client";

type SessionState = "idle" | "connecting" | "waiting" | "active" | "error";

function RemoteVideo({ stream }: { stream: MediaStream | null | undefined }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.srcObject = stream ?? null;
  }, [stream]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      className="w-full h-full object-cover rounded-2xl"
    />
  );
}

function LocalVideo({ stream }: { stream: MediaStream | null | undefined }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.srcObject = stream ?? null;
  }, [stream]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      className="w-full h-full object-cover rounded-xl mirror"
    />
  );
}

function AudioPlayer({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.srcObject = stream;
  }, [stream]);
  return <audio ref={ref} autoPlay />;
}

interface HelpRoomProps {
  onClose: () => void;
  onCallEnded?: (durationSecs: number) => void;
}

export default function HelpRoom({ onClose, onCallEnded }: HelpRoomProps) {
  const [state, setState] = useState<SessionState>("idle");
  const [error, setError] = useState<string>("");
  const [elapsed, setElapsed] = useState(0);
  const roomIdRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { joinRoom, leaveRoom, peerStatus } = useConnection();
  const { cameraStream } = useCamera();
  const { microphoneStream: _mic } = useMicrophone();
  void _mic; // ensure mic is captured
  const { remotePeers } = usePeers();
  const { initializeDevices } = useInitializeDevices();

  // Detect volunteer joining via remote peers
  useEffect(() => {
    if (state === "waiting" && remotePeers.length > 0) {
      setState("active");
    }
  }, [state, remotePeers.length]);

  // Timer for waiting/active
  useEffect(() => {
    if (state === "waiting" || state === "active") {
      if (!timerRef.current) {
        setElapsed(0);
        timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
      }
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state]);

  const startSession = useCallback(async () => {
    setState("connecting");
    setError("");
    try {
      // Create room + get peer token from backend
      const resp = await fetch("/api/room/create", { method: "POST" });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({ detail: resp.statusText }));
        throw new Error(body.detail || "Failed to create room");
      }
      const data = await resp.json();
      roomIdRef.current = data.room_id;

      // Initialize camera + mic
      await initializeDevices();

      // Join Fishjam room via WebRTC
      await joinRoom({ peerToken: data.peer_token });
      setState("waiting");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  }, [initializeDevices, joinRoom]);

  const stopSession = useCallback(async () => {
    const duration = elapsed;
    try { leaveRoom(); } catch { /* ignore */ }
    if (roomIdRef.current) {
      await fetch("/api/room/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_id: roomIdRef.current }),
      }).catch(() => {});
    }
    roomIdRef.current = null;
    setState("idle");
    if (duration > 0 && onCallEnded) {
      onCallEnded(duration);
    }
    onClose();
  }, [onClose, leaveRoom, elapsed, onCallEnded]);

  // Auto-start on mount
  useEffect(() => {
    startSession();
    return () => {
      try { leaveRoom(); } catch { /* ignore */ }
      if (roomIdRef.current) {
        fetch("/api/room/close", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ room_id: roomIdRef.current }),
        }).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const volunteerPeer = remotePeers[0];
  const volunteerVideo = volunteerPeer?.cameraTrack?.stream;
  const volunteerAudio = volunteerPeer?.microphoneTrack?.stream;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center"
    >
      {/* Active call — full screen video layout */}
      {state === "active" && (
        <div className="absolute inset-0 flex flex-col">
          {/* Remote video (volunteer) — fills screen */}
          <div className="flex-1 relative bg-black">
            {volunteerVideo ? (
              <RemoteVideo stream={volunteerVideo} />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-6xl">🤝</div>
              </div>
            )}
            {/* Hidden audio element for volunteer audio */}
            {volunteerAudio && <AudioPlayer stream={volunteerAudio} />}

            {/* Self-view pip (bottom-right) */}
            {cameraStream && (
              <div className="absolute bottom-20 right-4 w-28 h-40 rounded-xl overflow-hidden border-2 border-white/20 shadow-lg">
                <LocalVideo stream={cameraStream} />
              </div>
            )}

            {/* Timer overlay */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-sm rounded-full px-4 py-1.5">
              <span className="text-white/80 font-mono text-sm">
                {formatTime(elapsed)}
              </span>
            </div>

            {/* Connection status */}
            <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-white/70 text-xs">Połączono</span>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="bg-black/80 backdrop-blur-sm px-6 py-4 flex items-center justify-center gap-6">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={stopSession}
              className="px-8 py-3 rounded-full bg-red-500 text-white font-semibold text-lg shadow-lg shadow-red-500/30"
            >
              Zakończ rozmowę
            </motion.button>
          </div>
        </div>
      )}

      {/* Pre-call states (connecting / waiting / error) */}
      {state !== "active" && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="w-80 glass rounded-3xl p-8 flex flex-col items-center gap-6"
        >
          {/* Header */}
          <div className="text-center">
            <div className="text-4xl mb-2">🆘</div>
            <h2 className="text-xl font-bold text-white">Pomoc na żywo</h2>
            <p className="text-white/60 text-sm mt-1">
              {state === "connecting" && "Tworzenie pokoju..."}
              {state === "waiting" && "Czekanie na wolontariusza..."}
              {state === "error" && "Nie udało się połączyć"}
              {state === "idle" && "Gotowy do połączenia"}
            </p>
            {peerStatus !== "idle" && (
              <p className="text-white/30 text-xs mt-1">WebRTC: {peerStatus}</p>
            )}
          </div>

          {/* Status animation */}
          <div className="relative w-32 h-32 flex items-center justify-center">
            {state === "connecting" && (
              <div className="w-20 h-20 rounded-full border-4 border-amber-400/40 border-t-amber-400 animate-spin" />
            )}
            {state === "waiting" && (
              <>
                <div className="absolute w-32 h-32 rounded-full bg-amber-400/10 animate-pulse" />
                <div className="absolute w-24 h-24 rounded-full bg-amber-400/15 animate-pulse [animation-delay:0.5s]" />
                <div className="w-16 h-16 rounded-full bg-amber-400/20 flex items-center justify-center">
                  <span className="text-3xl">⏳</span>
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
            {state === "waiting" && (
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

          {/* Self-preview while waiting */}
          {state === "waiting" && cameraStream && (
            <div className="w-32 h-24 rounded-xl overflow-hidden border border-white/10">
              <LocalVideo stream={cameraStream} />
            </div>
          )}

          {/* Error */}
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
              className="px-6 py-3 rounded-full font-semibold bg-white/10 text-white/70"
            >
              Anuluj
            </motion.button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
