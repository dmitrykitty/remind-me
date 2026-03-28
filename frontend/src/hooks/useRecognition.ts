import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { RecognizedFace, RecognizedObject, UnknownFace } from "../api/types";

interface FrameSize {
  width: number;
  height: number;
}

interface UseRecognitionResult {
  faces: RecognizedFace[];
  unknownFaces: UnknownFace[];
  objects: RecognizedObject[];
  frameSize: FrameSize;
  connected: boolean;
}

const DEFAULT_INTERVAL_MS = 1500;
const CAPTURE_MAX_WIDTH = 640;

/**
 * Open a WebSocket to /ws/recognize.
 * Periodically capture a frame from the video, send it as base64 JSON,
 * and expose the latest recognition results.
 */
export function useRecognition(
  videoRef: RefObject<HTMLVideoElement | null>,
  enabled: boolean,
  intervalMs: number = DEFAULT_INTERVAL_MS,
): UseRecognitionResult {
  const [faces, setFaces] = useState<RecognizedFace[]>([]);
  const [unknownFaces, setUnknownFaces] = useState<UnknownFace[]>([]);
  const [objects, setObjects] = useState<RecognizedObject[]>([]);
  const [frameSize, setFrameSize] = useState<FrameSize>({ width: 640, height: 480 });
  const [connected, setConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const objectClearTimer = useRef<number | null>(null);

  // Stable capture callback
  const sendFrame = useCallback(() => {
    const video = videoRef.current;
    const ws = wsRef.current;
    if (!video || video.readyState < 2 || !ws || ws.readyState !== WebSocket.OPEN) {
      return;
    }

    if (!canvasRef.current) canvasRef.current = document.createElement("canvas");
    const canvas = canvasRef.current;

    // Scale down for bandwidth / processing speed
    const scale = Math.min(1, CAPTURE_MAX_WIDTH / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob: Blob | null) => {
        if (!blob) return;
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          const base64 = dataUrl.split(",")[1];
          ws.send(JSON.stringify({ type: "frame", data: base64 }));
        };
        reader.readAsDataURL(blob);
      },
      "image/jpeg",
      0.7,
    );
  }, [videoRef]);

  useEffect(() => {
    if (!enabled) {
      setFaces([]);
      setUnknownFaces([]);
      setObjects([]);
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/recognize`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      timerRef.current = window.setInterval(sendFrame, intervalMs);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.faces) setFaces(data.faces);
        setUnknownFaces(data.unknown_faces ?? []);
        if (data.objects) {
          setObjects(data.objects);
          // Auto-clear objects after 2s if no new detections arrive
          if (objectClearTimer.current) clearTimeout(objectClearTimer.current);
          if (data.objects.length > 0) {
            objectClearTimer.current = window.setTimeout(() => setObjects([]), 2000);
          }
        }
        if (data.frame_width && data.frame_height) {
          setFrameSize({ width: data.frame_width, height: data.frame_height });
        }
      } catch {
        /* ignore malformed messages */
      }
    };

    ws.onclose = () => {
      setConnected(false);
      if (timerRef.current) clearInterval(timerRef.current);
    };

    ws.onerror = () => ws.close();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      ws.close();
    };
  }, [enabled, intervalMs, sendFrame]);

  return { faces, unknownFaces, objects, frameSize, connected };
}
