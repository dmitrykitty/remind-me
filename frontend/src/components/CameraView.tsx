import type { RefObject } from "react";

interface CameraViewProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  enabled: boolean;
}

export default function CameraView({ videoRef, enabled }: CameraViewProps) {
  return (
    <>
      {enabled ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <span className="text-white/40 text-lg">Camera off</span>
        </div>
      )}
    </>
  );
}
