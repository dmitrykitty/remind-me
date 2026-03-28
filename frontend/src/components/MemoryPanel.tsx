import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { Person, KnownObject, Task, HistoryEntry } from "../api/types";
import {
  listPeople,
  listObjects,
  deletePerson,
  deleteObject,
  listTasks,
  createTask,
  updateTask,
  deleteTask,
  listHistory,
} from "../api/client";

interface MemoryPanelProps {
  onClose: () => void;
  onEnrollPerson: () => void;
  onEnrollObject: () => void;
  refreshKey?: number;
}

type Tab = "people" | "objects" | "tasks" | "history";

export default function MemoryPanel({
  onClose,
  onEnrollPerson,
  onEnrollObject,
  refreshKey,
}: MemoryPanelProps) {
  const [tab, setTab] = useState<Tab>("people");
  const [people, setPeople] = useState<Person[]>([]);
  const [objects, setObjects] = useState<KnownObject[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const reload = () => {
    listPeople().then(setPeople).catch(console.error);
    listObjects().then(setObjects).catch(console.error);
    listTasks().then(setTasks).catch(console.error);
    listHistory().then(setHistory).catch(console.error);
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

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;
    await createTask({ title: newTaskTitle.trim() });
    setNewTaskTitle("");
    reload();
  };

  const handleToggleTask = async (t: Task) => {
    await updateTask(t.id, { done: !t.done });
    reload();
  };

  const handleDeleteTask = async (id: string) => {
    await deleteTask(id);
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
      <div className="flex px-5 gap-1.5 mb-3 flex-wrap">
        <TabBtn active={tab === "people"} onClick={() => setTab("people")}>
          People ({people.length})
        </TabBtn>
        <TabBtn active={tab === "objects"} onClick={() => setTab("objects")}>
          Objects ({objects.length})
        </TabBtn>
        <TabBtn active={tab === "tasks"} onClick={() => setTab("tasks")}>
          Tasks ({tasks.filter((t) => !t.done).length})
        </TabBtn>
        <TabBtn active={tab === "history"} onClick={() => setTab("history")}>
          History
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

        {tab === "tasks" && (
          <>
            {/* Add task inline */}
            <div className="flex gap-2">
              <input
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
                placeholder="New task..."
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm placeholder-white/30 outline-none focus:border-mint-400/50"
              />
              <button
                onClick={handleAddTask}
                className="px-3 py-2 bg-mint-500/20 text-mint-300 rounded-xl text-sm font-medium shrink-0"
              >
                +
              </button>
            </div>

            {/* Active tasks */}
            {tasks
              .filter((t) => !t.done)
              .map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  onToggle={() => handleToggleTask(t)}
                  onDelete={() => handleDeleteTask(t.id)}
                />
              ))}

            {/* Completed */}
            {tasks.filter((t) => t.done).length > 0 && (
              <>
                <div className="text-white/30 text-xs mt-3 mb-1">Done</div>
                {tasks
                  .filter((t) => t.done)
                  .map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      onToggle={() => handleToggleTask(t)}
                      onDelete={() => handleDeleteTask(t.id)}
                    />
                  ))}
              </>
            )}

            {tasks.length === 0 && (
              <div className="text-white/30 text-sm text-center py-6">
                No tasks yet — say or type one!
              </div>
            )}
          </>
        )}

        {tab === "history" &&
          history.map((h) => (
            <HistoryCard key={h.id} entry={h} />
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
        {tab === "history" && history.length === 0 && (
          <div className="text-white/30 text-sm text-center py-6">
            No history yet
          </div>
        )}
      </div>

      {/* Add button */}
      {(tab === "people" || tab === "objects") && (
        <div className="px-5 pb-5">
          <button
            onClick={tab === "people" ? onEnrollPerson : onEnrollObject}
            className="w-full py-2.5 rounded-xl bg-mint-500/20 text-mint-300 hover:bg-mint-500/30 transition-colors text-sm font-medium"
          >
            + Add {tab === "people" ? "Person" : "Object"}
          </button>
        </div>
      )}
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

function TaskCard({
  task,
  onToggle,
  onDelete,
}: {
  task: import("../api/types").Task;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 bg-white/5 rounded-xl px-3 py-2">
      <button
        onClick={onToggle}
        className={`w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center transition-colors ${
          task.done
            ? "bg-emerald-500/30 border-emerald-400/50 text-emerald-300"
            : "border-white/20 hover:border-white/40"
        }`}
      >
        {task.done && <span className="text-xs">✓</span>}
      </button>
      <div className="flex-1 min-w-0">
        <div
          className={`text-sm truncate ${
            task.done ? "text-white/30 line-through" : "text-white"
          }`}
        >
          {task.title}
        </div>
        {task.due_at && (
          <div className="text-white/30 text-xs">
            {new Date(task.due_at).toLocaleString()}
          </div>
        )}
      </div>
      <button
        onClick={onDelete}
        className="text-white/20 hover:text-red-400 transition-colors text-sm shrink-0"
        aria-label="Delete task"
      >
        🗑
      </button>
    </div>
  );
}

const KIND_ICONS: Record<string, string> = {
  voice_command: "🎙️",
  volunteer_call: "📞",
  person_added: "👤",
  object_added: "📦",
  task_added: "✅",
  task_done: "☑️",
};

function HistoryCard({ entry }: { entry: import("../api/types").HistoryEntry }) {
  const icon = KIND_ICONS[entry.kind] ?? "📝";
  const time = new Date(entry.created_at).toLocaleString();
  return (
    <div className="bg-white/5 rounded-xl px-3 py-2">
      <div className="flex items-start gap-2">
        <span className="text-sm shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-white text-sm truncate">{entry.title}</div>
          {entry.summary && (
            <div className="text-white/50 text-xs mt-0.5">{entry.summary}</div>
          )}
          <div className="text-white/25 text-xs mt-0.5">{time}</div>
        </div>
      </div>
    </div>
  );
}
