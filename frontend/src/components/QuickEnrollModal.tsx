import { useState } from "react";
import { motion } from "framer-motion";
import { createPerson, addPersonSamples } from "../api/client";
import type { UnknownFace } from "../api/types";

interface QuickEnrollModalProps {
  face: UnknownFace;
  onClose: () => void;
  onSaved: () => void;
}

export default function QuickEnrollModal({
  face,
  onClose,
  onSaved,
}: QuickEnrollModalProps) {
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const person = await createPerson({
        name: name.trim(),
        relationship_label: relationship.trim(),
        notes: notes.trim(),
      });

      // Convert base64 crop to blob
      const byteString = atob(face.crop_base64);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: "image/jpeg" });

      await addPersonSamples(person.id, [blob]);
      onSaved();
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
        <h2 className="text-white font-semibold text-lg">Who is this?</h2>

        {/* Face preview */}
        <div className="flex justify-center">
          <img
            src={`data:image/jpeg;base64,${face.crop_base64}`}
            alt="Detected face"
            className="w-24 h-24 rounded-xl object-cover border-2 border-amber-400/50"
          />
        </div>

        {/* Form */}
        <input
          placeholder="Name *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          className="w-full bg-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30 outline-none focus:ring-1 focus:ring-mint-400"
        />
        <input
          placeholder="Relationship (e.g. daughter, doctor)"
          value={relationship}
          onChange={(e) => setRelationship(e.target.value)}
          className="w-full bg-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30 outline-none focus:ring-1 focus:ring-mint-400"
        />
        <input
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full bg-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30 outline-none focus:ring-1 focus:ring-mint-400"
        />

        {error && <div className="text-red-400 text-xs">{error}</div>}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl bg-white/10 text-white/60 text-sm hover:bg-white/15 transition-colors"
          >
            Skip
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
