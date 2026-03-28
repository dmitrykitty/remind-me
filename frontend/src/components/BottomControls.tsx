import { motion } from "framer-motion";

interface BottomControlsProps {
  micEnabled: boolean;
  cameraEnabled: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  isProcessing?: boolean;
}

function Btn({
  active,
  onClick,
  label,
  icon,
  pulse,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: string;
  pulse?: boolean;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      aria-label={label}
      className={`w-14 h-14 rounded-full flex items-center justify-center text-xl transition-colors relative
        ${active ? "glass text-white" : "bg-white/10 text-white/40 border border-white/5"}`}
    >
      {icon}
      {pulse && (
        <span className="absolute inset-0 rounded-full border-2 border-red-400 animate-ping opacity-50" />
      )}
    </motion.button>
  );
}

export default function BottomControls({
  micEnabled,
  cameraEnabled,
  onToggleMic,
  onToggleCamera,
  isProcessing,
}: BottomControlsProps) {
  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-6 z-30">
      <Btn
        active={micEnabled || !!isProcessing}
        onClick={onToggleMic}
        label={micEnabled ? "Stop recording" : "Start voice command"}
        icon={isProcessing ? "⏳" : micEnabled ? "⏹️" : "🎙️"}
        pulse={micEnabled}
      />
      <Btn
        active={cameraEnabled}
        onClick={onToggleCamera}
        label="Toggle camera"
        icon={cameraEnabled ? "📷" : "📷"}
      />
    </div>
  );
}
