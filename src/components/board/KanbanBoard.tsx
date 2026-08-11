"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates, arrayMove } from "@dnd-kit/sortable";
import { createClient } from "@/lib/supabase/client";
import KanbanColumn from "./KanbanColumn";
import KanbanCard from "./KanbanCard";
import TaskModal from "./TaskModal";
import type { TaskColumn, Task, Profile } from "@/types";
import { Plus } from "lucide-react";

interface Props {
  columns: (TaskColumn & { tasks: (Task & { profiles: Profile | null })[] })[];
  projectId: string;
  profiles: Profile[];
}

export default function KanbanBoard({ columns: initialColumns, projectId, profiles }: Props) {
  const [columns, setColumns] = useState(initialColumns);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const localSaveRef = useRef(false);
  const dragStartColRef = useRef<string | null>(null);
  const [modalTask, setModalTask] = useState<Task | null>(null);
  const [modalColumnId, setModalColumnId] = useState<string | null>(null);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Supabase Realtime — only reload for changes made by other users
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`board-${projectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `project_id=eq.${projectId}` },
        () => {
          if (localSaveRef.current) return;
          window.location.reload();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projectId]);

  function findColumn(taskId: string) {
    return columns.find((col) => col.tasks.some((t) => t.id === taskId));
  }

  function handleDragStart({ active }: DragStartEvent) {
    const col = findColumn(active.id as string);
    const task = col?.tasks.find((t) => t.id === active.id);
    setActiveTask(task ?? null);
    dragStartColRef.current = col?.id ?? null;
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const activeColId = findColumn(active.id as string)?.id;
    const overColId = columns.find((c) => c.id === over.id)?.id
      ?? findColumn(over.id as string)?.id;
    if (!activeColId || !overColId || activeColId === overColId) return;

    setColumns((prev) => {
      const activeCol = prev.find((c) => c.id === activeColId)!;
      const task = activeCol.tasks.find((t) => t.id === active.id)!;
      return prev.map((col) => {
        if (col.id === activeColId) return { ...col, tasks: col.tasks.filter((t) => t.id !== active.id) };
        if (col.id === overColId) return { ...col, tasks: [...col.tasks, { ...task, column_id: overColId }] };
        return col;
      }) as typeof prev;
    });
  }

  async function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveTask(null);
    if (!over) return;

    // Use dragStartColRef as the true origin — findColumn returns the destination
    // after handleDragOver already moved the task in state.
    const originColId = dragStartColRef.current;
    const currentColId = findColumn(active.id as string)?.id;
    if (!originColId || !currentColId) return;

    const supabase = createClient();
    localSaveRef.current = true;

    if (originColId !== currentColId) {
      // Cross-column drop: state already updated by handleDragOver, just persist to DB
      const task = columns.find((c) => c.id === currentColId)?.tasks.find((t) => t.id === active.id);
      if (!task) { localSaveRef.current = false; return; }
      await supabase.from("tasks").update({ column_id: currentColId, position: 9999 }).eq("id", task.id);
    } else {
      // Same-column reorder
      const overColId = columns.find((c) => c.id === over.id)?.id
        ?? findColumn(over.id as string)?.id;
      if (!overColId || overColId !== currentColId) { localSaveRef.current = false; return; }
      const col = columns.find((c) => c.id === currentColId)!;
      const oldIdx = col.tasks.findIndex((t) => t.id === active.id);
      const newIdx = col.tasks.findIndex((t) => t.id === over.id);
      if (oldIdx === newIdx) { localSaveRef.current = false; return; }
      const reordered = arrayMove(col.tasks, oldIdx, newIdx);
      setColumns((prev) => prev.map((c) => c.id === currentColId ? { ...c, tasks: reordered } : c));
      await Promise.all(reordered.map((t, i) => supabase.from("tasks").update({ position: i }).eq("id", t.id)));
    }

    setTimeout(() => { localSaveRef.current = false; }, 2000);
  }

  async function handleAddColumn() {
    if (!newColumnTitle.trim()) return;
    const supabase = createClient();
    const { data } = await supabase.from("task_columns").insert({
      project_id: projectId, title: newColumnTitle.trim(), position: columns.length, color: "#6366f1"
    }).select().single();
    if (data) setColumns((prev) => [...prev, { ...data, tasks: [] }]);
    setNewColumnTitle("");
    setShowAddColumn(false);
  }

  function openTaskModal(task: Task | null, columnId: string) {
    setModalTask(task);
    setModalColumnId(columnId);
  }

  function handleTaskSaved(task: Task, isNew: boolean) {
    localSaveRef.current = true;
    setTimeout(() => { localSaveRef.current = false; }, 2000);
    setColumns((prev) => prev.map((col) => {
      if (isNew && col.id === task.column_id) {
        return { ...col, tasks: [...col.tasks, { ...task, profiles: profiles.find((p) => p.id === task.assignee_id) ?? null }] };
      }
      if (!isNew && col.tasks.some((t) => t.id === task.id)) {
        return { ...col, tasks: col.tasks.map((t) => t.id === task.id ? { ...task, profiles: profiles.find((p) => p.id === task.assignee_id) ?? null } : t) };
      }
      return col;
    }) as typeof prev);
    setModalTask(null);
    setModalColumnId(null);
  }

  function handleTaskDeleted(taskId: string) {
    localSaveRef.current = true;
    setTimeout(() => { localSaveRef.current = false; }, 2000);
    setColumns((prev) => prev.map((col) => ({ ...col, tasks: col.tasks.filter((t) => t.id !== taskId) })) as typeof prev);
    setModalTask(null);
    setModalColumnId(null);
  }

  return (
    <div className="flex gap-4 p-6 h-full overflow-x-auto">
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        {columns.map((col) => (
          <KanbanColumn key={col.id} column={col} onAddTask={() => openTaskModal(null, col.id)} onCardClick={(task) => openTaskModal(task, col.id)} />
        ))}
        <DragOverlay>
          {activeTask && <KanbanCard task={activeTask} isDragging />}
        </DragOverlay>
      </DndContext>

      {/* Add Column */}
      <div className="shrink-0 w-72">
        {showAddColumn ? (
          <div className="bg-white border border-slate-200 rounded-xl p-3">
            <input
              autoFocus
              value={newColumnTitle}
              onChange={(e) => setNewColumnTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddColumn(); if (e.key === "Escape") setShowAddColumn(false); }}
              placeholder="Spaltenname..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none mb-2"
              onFocus={(e) => (e.target.style.boxShadow = "0 0 0 2px #00ffff30")}
              onBlur={(e) => (e.target.style.boxShadow = "")}
            />
            <div className="flex gap-2">
              <button onClick={handleAddColumn} className="flex-1 py-1.5 rounded-lg text-sm font-semibold" style={{ backgroundColor: "#00ffff", color: "#000000" }}>Hinzufügen</button>
              <button onClick={() => setShowAddColumn(false)} className="flex-1 py-1.5 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 text-slate-600">Abbrechen</button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddColumn(true)}
            className="w-full flex items-center gap-2 px-4 py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 transition text-sm hover:text-slate-600"
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "#00ffff")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "")}
          >
            <Plus className="w-4 h-4" /> Spalte hinzufügen
          </button>
        )}
      </div>

      {/* Task Modal */}
      {modalColumnId && (
        <TaskModal
          task={modalTask}
          columnId={modalColumnId}
          projectId={projectId}
          profiles={profiles}
          onSave={handleTaskSaved}
          onDelete={handleTaskDeleted}
          onClose={() => { setModalTask(null); setModalColumnId(null); }}
        />
      )}
    </div>
  );
}
