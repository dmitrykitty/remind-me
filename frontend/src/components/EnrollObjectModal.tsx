import { useState, type RefObject } from "react";
import { motion } from "framer-motion";
import { createObject, addObjectSamples } from "../api/client";

interface EnrollObjectModalProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  onClose: () => void;
}

export default function EnrollObjectModal({
  videoRef,
  onClose,
}: EnrollObjectModalProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [captures, setCaptures] = useState<{ blob: Blob; url: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const captureFrame = async () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob((b) => res(b), "image/jpeg", 0.9),
    );
    if (blob) {
      setCaptures((prev) => [...prev, { blob, url: URL.createObjectURL(blob) }]);
    }
  };

  const removeCapture = (idx: number) => {
    setCaptures((prev) => {
      URL.revokeObjectURL(prev[idx].url);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (captures.length === 0) {
      setError("Capture at least one photo");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const obj = await createObject({
        name: name.trim(),
        category: category.trim(),
        notes: notes.trim(),
      });
      await addObjectSamples(
        obj.id,
        captures.map((c) => c.blob),
      );
      onClose();
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="glass rounded-2xl w-full max-w-sm p-5 space-y-4"
      >
        <h2 className="text-white font-semibold text-lg">Add Object / Item</h2>

        {/* Captured photos */}
        <div className="flex gap-2 flex-wrap">
          {captures.map((c, i) => (
            <div key={i} className="relative">
              <img
                src={c.url}
                alt={`capture ${i + 1}`}
                className="w-16 h-16 rounded-lg object-cover"
              />
              <button
                onClick={() => removeCapture(i)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center"
              >
                ✕
              </button>
            </div>
          ))}
          {captures.length < 5 && (
            <button
              onClick={captureFrame}
              className="w-16 h-16 rounded-lg border-2 border-dashed border-white/20 flex items-center justify-center text-white/40 hover:border-mint-400 hover:text-mint-400 transition-colors text-xl"
            >
              📸
            </button>
          )}
        </div>

        {/* Form */}
        <input
          placeholder="Object name *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30 outline-none focus:ring-1 focus:ring-mint-400"
        />
        <input
          placeholder="Category (e.g. medicine, keys)"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full bg-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30 outline-none focus:ring-1 focus:ring-mint-400"
        />
        <input
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full bg-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30 outline-none focus:ring-1 focus:ring-mint-400"
        />

        {error && <div className="text-red-400 text-xs">{error}</div>}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl bg-white/10 text-white/60 text-sm hover:bg-white/15 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2 rounded-xl bg-mint-500/30 text-mint-300 text-sm font-medium hover:bg-mint-500/40 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
