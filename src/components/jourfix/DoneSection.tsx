"use client";

import { useEffect, useState } from "react";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CheckCircle2, ChevronRight } from "lucide-react";
import type { JourfixArea, JourfixNote, JourfixTask, JourfixWeek, Profile } from "@/types";
import { cn } from "@/lib/utils";
import TaskRow, { ColumnHeader, type NoteHandlers, type TaskPatch } from "./TaskRow";
import type { ProjectOption } from "./utils";

const COLLAPSED_KEY = "jourfix:done-collapsed";

interface Props {
  tasks: JourfixTask[];
  areas: JourfixArea[];
  profiles: Profile[];
  projects: ProjectOption[];
  customers: { id: string; name: string }[];
  topicSuggestionsByArea: Map<string, string[]>;
  notesByThread: Map<string, JourfixNote[]>;
  weeks: JourfixWeek[];
  currentUserId: string | null;
  isAdmin: boolean;
  noteHandlers: NoteHandlers;
  onToggleDone: (taskId: string, done: boolean) => void;
  onUpdateTask: (taskId: string, patch: TaskPatch) => void;
  onDeleteTask: (task: JourfixTask) => void;
  onLinked: (taskId: string) => void;
  onChangeCustomer: (task: JourfixTask, customerId: string) => void;
}

/** Feste Sektion am Ende der Liste: alle erledigten Aufgaben der Woche, mit ihrer Ursprungskategorie. */
export default function DoneSection({
  tasks,
  areas,
  profiles,
  projects,
  customers,
  topicSuggestionsByArea,
  notesByThread,
  weeks,
  currentUserId,
  isAdmin,
  noteHandlers,
  onToggleDone,
  onUpdateTask,
  onDeleteTask,
  onLinked,
  onChangeCustomer,
}: Props) {
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(COLLAPSED_KEY);
      if (stored !== null) setCollapsed(stored === "1");
    } catch {}
  }, []);

  function toggle() {
    setCollapsed((v) => {
      try { localStorage.setItem(COLLAPSED_KEY, v ? "0" : "1"); } catch {}
      return !v;
    });
  }

  const areaById = new Map(areas.map((a) => [a.id, a]));
  const areaOrder = new Map(areas.map((a) => [a.id, a.position]));
  const sorted = [...tasks].sort(
    (a, b) =>
      (areaOrder.get(a.area_id) ?? 0) - (areaOrder.get(b.area_id) ?? 0) ||
      b.updated_at.localeCompare(a.updated_at)
  );

  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <header className="flex items-center gap-2 pl-2 pr-3 py-2.5 bg-emerald-50/60 border-b border-slate-200">
        <span className="w-5" />
        <button
          onClick={toggle}
          className="flex items-center gap-2 min-w-0 text-left"
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Abgeschlossen aufklappen" : "Abgeschlossen zuklappen"}
        >
          <ChevronRight className={cn("w-4 h-4 text-slate-400 transition-transform", !collapsed && "rotate-90")} />
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <h3 className="font-semibold text-sm text-slate-800">Abgeschlossen</h3>
        </button>
        <span className="text-xs tabular-nums text-slate-500">{tasks.length} erledigt</span>
      </header>

      {!collapsed && (
        <>
          {sorted.length > 0 && <ColumnHeader lead="Kategorie · Thema / Kunde" main="Aufgabe / ToDo" />}
          <SortableContext items={sorted.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            <div className="divide-y divide-slate-100">
              {sorted.map((task) => {
                const area = areaById.get(task.area_id);
                return (
                  <TaskRow
                    key={task.id}
                    task={task}
                    profiles={profiles}
                    projects={projects}
                    sortable={false}
                    onToggleDone={onToggleDone}
                    onUpdate={onUpdateTask}
                    onDelete={onDeleteTask}
                    onLinked={onLinked}
                    notes={notesByThread.get(task.thread_id) ?? []}
                    weeks={weeks}
                    currentUserId={currentUserId}
                    isAdmin={isAdmin}
                    noteHandlers={noteHandlers}
                    variant={area?.kind === "customers" ? "customer" : "topic"}
                    areaLabel={area?.name ?? "Ohne Kategorie"}
                    topicSuggestions={topicSuggestionsByArea.get(task.area_id) ?? []}
                    customers={customers}
                    onChangeCustomer={onChangeCustomer}
                  />
                );
              })}
            </div>
          </SortableContext>
          {sorted.length === 0 && <p className="text-xs text-slate-400 py-4 text-center">Noch nichts abgeschlossen</p>}
        </>
      )}
    </section>
  );
}
