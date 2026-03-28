import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TopControlsProps {
  onSettings: () => void;
  onMemory: () => void;
  onAddPerson: () => void;
  onAddObject: () => void;
}

export default function TopControls({
  onSettings,
  onMemory,
  onAddPerson,
  onAddObject,
}: TopControlsProps) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <>
      {/* Top-right buttons */}
      <div className="absolute top-6 right-6 flex gap-3 z-30">
        <SmallBtn label="Memory" icon="🧠" onClick={onMemory} />
        <SmallBtn label="Settings" icon="⚙️" onClick={onSettings} />
      </div>

      {/* Add button — top-left */}
      <div className="absolute top-6 left-6 z-30">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setAddOpen((v) => !v)}
          className="glass w-12 h-12 rounded-full flex items-center justify-center text-xl"
          aria-label="Add"
        >
          ＋
        </motion.button>

        <AnimatePresence>
          {addOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              className="glass mt-2 rounded-xl overflow-hidden"
            >
              <button
                className="block w-full text-left px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-colors"
                onClick={() => {
                  setAddOpen(false);
                  onAddPerson();
                }}
              >
                👤 Add Person
              </button>
              <button
                className="block w-full text-left px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-colors"
                onClick={() => {
                  setAddOpen(false);
                  onAddObject();
                }}
              >
                📦 Add Object
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

function SmallBtn({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      aria-label={label}
      className="glass w-11 h-11 rounded-full flex items-center justify-center text-base"
    >
      {icon}
    </motion.button>
  );
}
