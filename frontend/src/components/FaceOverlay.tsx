import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { RecognizedFace } from "../api/types";

interface FaceOverlayProps {
  face: RecognizedFace;
  frameSize: { width: number; height: number };
}

/**
 * Map bounding box from recognition-frame coordinates to screen
 * coordinates, accounting for the video's object-fit: cover display.
 */
function frameToScreen(
  bbox: { x: number; y: number; w: number; h: number },
  frameW: number,
  frameH: number,
  displayW: number,
  displayH: number,
) {
  const frameAspect = frameW / frameH;
  const displayAspect = displayW / displayH;

  let scale: number, offsetX: number, offsetY: number;
  if (frameAspect > displayAspect) {
    scale = displayH / frameH;
    offsetX = (displayW - frameW * scale) / 2;
    offsetY = 0;
  } else {
    scale = displayW / frameW;
    offsetX = 0;
    offsetY = (displayH - frameH * scale) / 2;
  }

  return {
    x: bbox.x * scale + offsetX,
    y: bbox.y * scale + offsetY,
    w: bbox.w * scale,
    h: bbox.h * scale,
  };
}

export default function FaceOverlay({ face, frameSize }: FaceOverlayProps) {
  const [displaySize, setDisplaySize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const onResize = () =>
      setDisplaySize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const pos = frameToScreen(
    face.bbox,
    frameSize.width,
    frameSize.height,
    displaySize.width,
    displaySize.height,
  );

  const labelX = pos.x + pos.w / 2;
  const labelY = Math.max(pos.y - 8, 36);

  return (
    <>
      {/* Bounding box highlight */}
      <div
        className="absolute rounded-lg border-2 border-mint-400/60 pointer-events-none z-20"
        style={{ left: pos.x, top: pos.y, width: pos.w, height: pos.h }}
      />

      {/* Info label */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="absolute pointer-events-none z-20"
        style={{ left: labelX, top: labelY, transform: "translate(-50%, -100%)" }}
      >
        <div className="glass rounded-xl px-3 py-2 text-white text-sm whitespace-nowrap max-w-[250px]">
          <div className="font-semibold truncate">{face.name}</div>
          {face.relationship_label && (
            <div className="text-mint-300 text-xs">{face.relationship_label}</div>
          )}
          {face.notes && (
            <div className="text-white/50 text-xs mt-0.5 truncate">{face.notes}</div>
          )}
          <div className="text-white/30 text-[10px] mt-0.5">
            {Math.round(face.confidence * 100)}%
          </div>
        </div>

        {/* Connector dot */}
        <div className="mx-auto mt-0.5 w-1.5 h-1.5 rounded-full bg-mint-400/80" />
      </motion.div>
    </>
  );
}
