import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { UnknownFace } from "../api/types";

interface UnknownFaceOverlayProps {
  face: UnknownFace;
  frameSize: { width: number; height: number };
  onTap: (face: UnknownFace) => void;
}

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

export default function UnknownFaceOverlay({
  face,
  frameSize,
  onTap,
}: UnknownFaceOverlayProps) {
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

  return (
    <>
      {/* Dashed bounding box for unknown face */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute rounded-lg border-2 border-dashed border-amber-400/70 cursor-pointer z-20"
        style={{ left: pos.x, top: pos.y, width: pos.w, height: pos.h }}
        onClick={() => onTap(face)}
      />

      {/* "Add" button above the box */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        className="absolute z-20 cursor-pointer"
        style={{
          left: pos.x + pos.w / 2,
          top: Math.max(pos.y - 8, 28),
          transform: "translate(-50%, -100%)",
        }}
        onClick={() => onTap(face)}
      >
        <div className="flex items-center gap-1.5 bg-amber-500/80 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-lg hover:bg-amber-500 transition-colors">
          <span className="text-white text-xs font-semibold">＋ Add</span>
        </div>
        <div className="mx-auto mt-0.5 w-1.5 h-1.5 rounded-full bg-amber-400/80" />
      </motion.div>
    </>
  );
}
