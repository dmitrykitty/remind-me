import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { AppSettings } from "../api/types";
import { getSettings, updateSettings, resetMemory } from "../api/client";

interface SettingsPanelProps {
  onClose: () => void;
}

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSettings().then(setSettings).catch(console.error);
  }, []);

  const patch = async (partial: Partial<AppSettings>) => {
    setSaving(true);
    try {
      const updated = await updateSettings(partial);
      setSettings(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Delete ALL enrolled people, objects, and embeddings?")) return;
    await resetMemory();
    alert("Memory cleared.");
  };

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 26, stiffness: 260 }}
      className="absolute top-0 right-0 w-80 h-full glass z-50 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <h2 className="text-lg font-semibold text-white">Settings</h2>
        <button onClick={onClose} className="text-white/50 hover:text-white text-xl">
          ✕
        </button>
      </div>

      {!settings ? (
        <div className="px-5 text-white/40 text-sm">Loading…</div>
      ) : (
        <div className="flex-1 overflow-y-auto hide-scrollbar px-5 pb-6 space-y-5 text-sm">
          {/* Face recognition toggle */}
          <Toggle
            label="Face recognition"
            checked={settings.face_recognition_enabled}
            onChange={(v) => patch({ face_recognition_enabled: v })}
          />

          {/* Object recognition toggle */}
          <Toggle
            label="Object recognition"
            checked={settings.object_recognition_enabled}
            onChange={(v) => patch({ object_recognition_enabled: v })}
          />

          {/* Face threshold */}
          <Slider
            label="Face distance threshold"
            value={settings.face_distance_threshold}
            min={0.1}
            max={0.8}
            step={0.05}
            onChange={(v) => patch({ face_distance_threshold: v })}
          />

          {/* Object threshold */}
          <Slider
            label="Object distance threshold"
            value={settings.object_distance_threshold}
            min={0.1}
            max={0.8}
            step={0.05}
            onChange={(v) => patch({ object_distance_threshold: v })}
          />

          {/* Frame interval */}
          <Slider
            label="Frame interval (ms)"
            value={settings.frame_interval_ms}
            min={500}
            max={5000}
            step={250}
            onChange={(v) => patch({ frame_interval_ms: v })}
          />

          {/* Danger zone */}
          <div className="pt-4 border-t border-white/10">
            <button
              onClick={handleReset}
              className="w-full py-2 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors text-sm"
            >
              Clear all memory
            </button>
          </div>

          {saving && (
            <div className="text-mint-400 text-xs text-center">Saving…</div>
          )}
        </div>
      )}
    </motion.div>
  );
}

/* ---- small sub-components ---- */

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between text-white/80 cursor-pointer">
      <span>{label}</span>
      <div
        onClick={() => onChange(!checked)}
        className={`w-10 h-5 rounded-full relative transition-colors ${
          checked ? "bg-mint-500" : "bg-white/20"
        }`}
      >
        <div
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </div>
    </label>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between text-white/60 mb-1">
        <span>{label}</span>
        <span className="text-white/80 font-mono text-xs">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-mint-400"
      />
    </div>
  );
}
