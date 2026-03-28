import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { Person, KnownObject } from "../api/types";
import { listPeople, listObjects, deletePerson, deleteObject } from "../api/client";

interface MemoryPanelProps {
  onClose: () => void;
  onEnrollPerson: () => void;
  onEnrollObject: () => void;
  refreshKey?: number;
}

type Tab = "people" | "objects";

export default function MemoryPanel({
  onClose,
  onEnrollPerson,
  onEnrollObject,
  refreshKey,
}: MemoryPanelProps) {
  const [tab, setTab] = useState<Tab>("people");
  const [people, setPeople] = useState<Person[]>([]);
  const [objects, setObjects] = useState<KnownObject[]>([]);

  const reload = () => {
    listPeople().then(setPeople).catch(console.error);
    listObjects().then(setObjects).catch(console.error);
  };

  useEffect(() => {
    reload();
  }, [refreshKey]);

  const handleDeletePerson = async (id: string) => {
    if (!confirm("Delete this person and all their data?")) return;
    await deletePerson(id);
    reload();
  };

  const handleDeleteObject = async (id: string) => {
    if (!confirm("Delete this object and all its data?")) return;
    await deleteObject(id);
    reload();
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
      <div className="flex items-center justify-between px-5 pt-5 pb-2">
        <h2 className="text-lg font-semibold text-white">Memory</h2>
        <button onClick={onClose} className="text-white/50 hover:text-white text-xl">
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div className="flex px-5 gap-2 mb-3">
        <TabBtn active={tab === "people"} onClick={() => setTab("people")}>
          People ({people.length})
        </TabBtn>
        <TabBtn active={tab === "objects"} onClick={() => setTab("objects")}>
          Objects ({objects.length})
        </TabBtn>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto hide-scrollbar px-5 pb-4 space-y-2">
        {tab === "people" &&
          people.map((p) => (
            <Card
              key={p.id}
              thumbnail={p.photos[0]?.photo_path}
              title={p.name}
              subtitle={p.relationship_label}
              onDelete={() => handleDeletePerson(p.id)}
            />
          ))}

        {tab === "objects" &&
          objects.map((o) => (
            <Card
              key={o.id}
              thumbnail={o.photos[0]?.photo_path}
              title={o.name}
              subtitle={o.category}
              onDelete={() => handleDeleteObject(o.id)}
            />
          ))}

        {tab === "people" && people.length === 0 && (
          <div className="text-white/30 text-sm text-center py-6">
            No people enrolled yet
          </div>
        )}
        {tab === "objects" && objects.length === 0 && (
          <div className="text-white/30 text-sm text-center py-6">
            No objects enrolled yet
          </div>
        )}
      </div>

      {/* Add button */}
      <div className="px-5 pb-5">
        <button
          onClick={tab === "people" ? onEnrollPerson : onEnrollObject}
          className="w-full py-2.5 rounded-xl bg-mint-500/20 text-mint-300 hover:bg-mint-500/30 transition-colors text-sm font-medium"
        >
          + Add {tab === "people" ? "Person" : "Object"}
        </button>
      </div>
    </motion.div>
  );
}

/* ---- sub-components ---- */

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        active
          ? "bg-white/15 text-white"
          : "text-white/40 hover:text-white/60"
      }`}
    >
      {children}
    </button>
  );
}

function Card({
  thumbnail,
  title,
  subtitle,
  onDelete,
}: {
  thumbnail?: string;
  title: string;
  subtitle?: string;
  onDelete: () => void;
}) {
  const imgSrc = thumbnail ? `/media/${thumbnail}` : undefined;
  return (
    <div className="flex items-center gap-3 bg-white/5 rounded-xl px-3 py-2">
      {imgSrc ? (
        <img
          src={imgSrc}
          alt={title}
          className="w-10 h-10 rounded-lg object-cover shrink-0"
        />
      ) : (
        <div className="w-10 h-10 rounded-lg bg-white/10 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-white text-sm font-medium truncate">{title}</div>
        {subtitle && (
          <div className="text-white/40 text-xs truncate">{subtitle}</div>
        )}
      </div>
      <button
        onClick={onDelete}
        className="text-white/30 hover:text-red-400 transition-colors text-sm shrink-0"
        aria-label="Delete"
      >
        🗑
      </button>
    </div>
  );
}
