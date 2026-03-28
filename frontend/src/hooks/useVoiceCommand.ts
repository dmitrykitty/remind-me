import { useCallback, useRef, useState, type RefObject } from "react";

interface VoiceCommandResult {
  success: boolean;
  intent?: string;
  message?: string;
  name?: string;
  transcript?: string;
  error?: string;
  person_id?: string;
  object_id?: string;
  face_enrolled?: boolean;
  appearance_enrolled?: boolean;
}

interface UseVoiceCommandResult {
  isRecording: boolean;
  isProcessing: boolean;
  lastResult: VoiceCommandResult | null;
  startRecording: () => void;
  stopRecording: () => void;
  clearResult: () => void;
}

/**
 * Hook for recording audio and sending voice commands to the backend.
 * Captures audio via MediaRecorder and sends it along with a camera frame
 * to POST /api/voice/command for Gemini-powered transcription and parsing.
 */
export function useVoiceCommand(
  videoRef: RefObject<HTMLVideoElement | null>,
): UseVoiceCommandResult {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<VoiceCommandResult | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const captureFrame = useCallback((): Blob | null => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);

    // Convert to blob synchronously via toDataURL
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const base64 = dataUrl.split(",")[1];
    const bytes = atob(base64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new Blob([arr], { type: "image/jpeg" });
  }, [videoRef]);

  const sendToBackend = useCallback(
    async (audioBlob: Blob) => {
      setIsProcessing(true);
      try {
        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.webm");

        // Capture current frame
        const frameBlob = captureFrame();
        if (frameBlob) {
          formData.append("frame", frameBlob, "frame.jpg");
        }

        const response = await fetch("/api/voice/command", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const text = await response.text().catch(() => response.statusText);
          setLastResult({
            success: false,
            error: `Server error: ${response.status} - ${text}`,
          });
          return;
        }

        const result: VoiceCommandResult = await response.json();
        setLastResult(result);
      } catch (err) {
        setLastResult({
          success: false,
          error: `Network error: ${err instanceof Error ? err.message : String(err)}`,
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [captureFrame],
  );

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        chunksRef.current = [];

        // Stop mic stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }

        if (audioBlob.size > 0) {
          sendToBackend(audioBlob);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setLastResult(null);
    } catch (err) {
      console.error("Failed to start recording:", err);
      setLastResult({
        success: false,
        error: "Microphone access denied",
      });
    }
  }, [sendToBackend]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const clearResult = useCallback(() => setLastResult(null), []);

  return {
    isRecording,
    isProcessing,
    lastResult,
    startRecording,
    stopRecording,
    clearResult,
  };
}
