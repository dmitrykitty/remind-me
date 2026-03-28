import { AnimatePresence, motion } from "framer-motion";
import type { RecognizedObject } from "../api/types";

interface ObjectOverlayProps {
  objects: RecognizedObject[];
}

export default function ObjectOverlay({ objects }: ObjectOverlayProps) {
  if (objects.length === 0) return null;

  return (
    <>
      {/* Pulsing border around entire viewport when objects detected */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-4 rounded-2xl border-2 border-cyan-400/40 pointer-events-none z-10"
      />

      {/* Corner accents */}
      {["top-4 left-4", "top-4 right-4", "bottom-4 left-4", "bottom-4 right-4"].map(
        (pos, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`absolute ${pos} w-6 h-6 pointer-events-none z-10`}
          >
            <div
              className={`absolute w-full h-full ${
                pos.includes("right") ? "scale-x-[-1]" : ""
              } ${pos.includes("bottom") ? "scale-y-[-1]" : ""}`}
            >
              <div className="absolute top-0 left-0 w-full h-0.5 bg-cyan-400/70 rounded-full" />
              <div className="absolute top-0 left-0 w-0.5 h-full bg-cyan-400/70 rounded-full" />
            </div>
          </motion.div>
        ),
      )}

      {/* Object labels — floating cards at bottom */}
      <div className="absolute bottom-28 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none z-20">
        <AnimatePresence>
          {objects.map((obj) => (
            <motion.div
              key={obj.object_id}
              initial={{ opacity: 0, scale: 0.85, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.25 }}
              className="glass rounded-xl px-4 py-2.5 text-white text-sm flex items-center gap-2 border border-cyan-400/30"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shrink-0 animate-pulse" />
              <span className="font-semibold">{obj.name}</span>
              {obj.category && (
                <span className="text-white/40 text-xs">· {obj.category}</span>
              )}
              <span className="text-white/30 text-[10px]">
                {Math.round(obj.confidence * 100)}%
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}
