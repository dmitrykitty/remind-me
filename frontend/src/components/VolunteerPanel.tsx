import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useConnection,
  useCamera,
  useMicrophone,
  usePeers,
  useInitializeDevices,
} from "@fishjam-cloud/react-client";

interface WaitingRoom {
  room_id: string;
  waiting_seconds: number;
}

type VolunteerState = "lobby" | "joining" | "active" | "error";

function VideoPlayer({ stream }: { stream: MediaStream | null | undefined }) {
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

function SelfView({ stream }: { stream: MediaStream | null | undefined }) {
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

export default function VolunteerPanel() {
  const [rooms, setRooms] = useState<WaitingRoom[]>([]);
  const [state, setState] = useState<VolunteerState>("lobby");
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { joinRoom: fishjamJoin, leaveRoom, peerStatus } = useConnection();
  const { cameraStream } = useCamera();
  const { microphoneStream: _mic } = useMicrophone();
  void _mic;
  const { remotePeers } = usePeers();
  const { initializeDevices } = useInitializeDevices();

  // Poll for waiting rooms
  useEffect(() => {
    if (state !== "lobby") return;

    const poll = async () => {
      try {
        const resp = await fetch("/api/room/waiting");
        if (resp.ok) {
          setRooms(await resp.json());
        }
      } catch {
        // ignore
      }
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [state]);

  // Call timer
  useEffect(() => {
    if (state === "active") {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state]);

  const joinRoom = useCallback(async (roomId: string) => {
    setState("joining");
    setError("");
    try {
      // Get peer token from backend
      const resp = await fetch("/api/room/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_id: roomId }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({ detail: resp.statusText }));
        throw new Error(body.detail || "Failed to join");
      }
      const data = await resp.json();

      // Initialize camera + mic
      await initializeDevices();

      // Join Fishjam room via WebRTC
      await fishjamJoin({ peerToken: data.peer_token });

      setActiveRoomId(roomId);
      setState("active");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  }, [initializeDevices, fishjamJoin]);

  const endCall = useCallback(async () => {
    try { leaveRoom(); } catch { /* ignore */ }
    if (activeRoomId) {
      await fetch("/api/room/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_id: activeRoomId }),
      }).catch(() => {});
    }
    setActiveRoomId(null);
    setState("lobby");
  }, [activeRoomId, leaveRoom]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const userPeer = remotePeers[0];
  const userVideo = userPeer?.cameraTrack?.stream;
  const userAudio = userPeer?.microphoneTrack?.stream;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Active call — full screen video */}
      {state === "active" && (
        <div className="fixed inset-0 flex flex-col bg-slate-900">
          {/* Remote video (user) */}
          <div className="flex-1 relative bg-black">
            {userVideo ? (
              <VideoPlayer stream={userVideo} />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="text-6xl mb-4">📷</div>
                  <p className="text-white/40">Oczekiwanie na obraz użytkownika...</p>
                </div>
              </div>
            )}
            {userAudio && <AudioPlayer stream={userAudio} />}

            {/* Self-view pip */}
            {cameraStream && (
              <div className="absolute bottom-20 right-4 w-28 h-40 rounded-xl overflow-hidden border-2 border-white/20 shadow-lg">
                <SelfView stream={cameraStream} />
              </div>
            )}

            {/* Timer + status */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-sm rounded-full px-4 py-1.5 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-white/80 font-mono text-sm">
                {formatTime(elapsed)}
              </span>
            </div>

            {/* WebRTC status */}
            <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1.5">
              <span className="text-white/50 text-xs">{peerStatus}</span>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="bg-black/80 backdrop-blur-sm px-6 py-4 flex items-center justify-between">
            <p className="text-white/40 text-xs font-mono">
              Pokój: {activeRoomId?.slice(0, 12)}...
            </p>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={endCall}
              className="px-8 py-3 rounded-full bg-red-500 text-white font-semibold shadow-lg shadow-red-500/30"
            >
              Zakończ rozmowę
            </motion.button>
          </div>
        </div>
      )}

      {/* Non-call states */}
      {state !== "active" && (
        <div className="max-w-lg mx-auto px-4 py-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">🤝 Panel Wolontariusza</h1>
            <p className="text-white/60">
              Pomagaj osobom z trudnościami pamięciowymi
            </p>
          </div>

          {/* Lobby — show waiting rooms */}
          {state === "lobby" && (
            <div>
              <h2 className="text-lg font-semibold mb-4 text-white/80">
                Oczekujące pokoje ({rooms.length})
              </h2>

              {rooms.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-5xl mb-4">☕</div>
                  <p className="text-white/50">
                    Brak oczekujących — wszystko OK!
                  </p>
                  <p className="text-white/30 text-sm mt-2">
                    Lista odświeża się automatycznie co 3 sekundy
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <AnimatePresence>
                    {rooms.map((room) => (
                      <motion.div
                        key={room.room_id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -100 }}
                        className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-mono text-sm text-white/70">
                            {room.room_id.slice(0, 12)}...
                          </p>
                          <p className="text-amber-400 text-sm mt-1">
                            ⏳ Czeka {room.waiting_seconds}s
                          </p>
                        </div>
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => joinRoom(room.room_id)}
                          className="px-5 py-2.5 rounded-full bg-emerald-500 text-white font-semibold text-sm shadow-lg shadow-emerald-500/20"
                        >
                          Dołącz
                        </motion.button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          )}

          {/* Joining */}
          {state === "joining" && (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto rounded-full border-4 border-emerald-400/40 border-t-emerald-400 animate-spin" />
              <p className="mt-6 text-white/60">Dołączanie do pokoju...</p>
            </div>
          )}

          {/* Error */}
          {state === "error" && (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">❌</div>
              <p className="text-red-300 mb-6">{error}</p>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setState("lobby")}
                className="px-6 py-3 rounded-full bg-white/10 text-white font-semibold"
              >
                Wróć do lobby
              </motion.button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
