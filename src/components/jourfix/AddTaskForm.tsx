"use client";

import { useMemo, useState } from "react";
import { Building2, CalendarDays, Link2 } from "lucide-react";
import type { Profile } from "@/types";
import { cn } from "@/lib/utils";
import { AssigneePicker, PriorityPicker } from "./TaskRow";
import type { Priority, ProjectOption } from "./utils";

export type NewTaskParams = {
  title: string;
  assigneeId: string | null;
  dueDate: string | null;
  priority: Priority;
  linkToBoard: boolean;
  projectId?: string;
  columnId?: string;
  /** Nur in der Kategorie „Kunden“: legt zusätzlich einen Kundenpunkt an */
  customerId?: string;
};

interface Props {
  profiles: Profile[];
  projects: ProjectOption[];
  /** Gesetzt = Kategorie „Kunden“, Kunde ist Pflicht */
  customers?: { id: string; name: string }[];
  onSubmit: (params: NewTaskParams) => void;
  onCancel: () => void;
}

export default function AddTaskForm({ profiles, projects, customers, onSubmit, onCancel }: Props) {
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [linkToBoard, setLinkToBoard] = useState(false);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [columnId, setColumnId] = useState("");
  const [customerId, setCustomerId] = useState("");

  const columns = useMemo(() => {
    const project = projects.find((p) => p.id === projectId);
    return [...(project?.task_columns ?? [])].sort((a, b) => a.position - b.position);
  }, [projects, projectId]);

  const effectiveColumnId = columnId || columns[0]?.id || "";
  const assignee = profiles.find((p) => p.id === assigneeId) ?? null;

  function submit() {
    if (!title.trim()) return;
    if (linkToBoard && (!projectId || !effectiveColumnId)) return;
    if (customers && !customerId) return;
    onSubmit({
      customerId: customers ? customerId : undefined,
      title: title.trim(),
      assigneeId,
      dueDate: dueDate || null,
      priority,
      linkToBoard,
      projectId: linkToBoard ? projectId : undefined,
      columnId: linkToBoard ? effectiveColumnId : undefined,
    });
    // Formular für die nächste Aufgabe offen lassen, Titel leeren
    setTitle("");
  }

  return (
    <div className="rounded-lg border border-cyan-200 bg-cyan-50/30 p-2 flex flex-col gap-2">
      {customers && (
        <label className="flex items-center gap-1.5 text-xs text-slate-500">
          <Building2 className="w-3.5 h-3.5 shrink-0" />
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className={cn(
              "flex-1 min-w-0 px-2 py-1.5 border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ring",
              customerId ? "border-slate-200 text-slate-700" : "border-amber-300 text-slate-400"
            )}
            aria-label="Kunde"
          >
            <option value="">Kunde wählen…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
      )}
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
            if (e.key === "Escape") onCancel();
          }}
          placeholder="Neue Aufgabe… (Enter zum Speichern)"
          className="flex-1 min-w-0 px-2.5 py-1.5 border border-slate-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <AssigneePicker assignee={assignee} profiles={profiles} onChange={setAssigneeId} size={26} />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <label className="flex items-center gap-1" title="Fällig am">
          <CalendarDays className="w-3.5 h-3.5" />
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="px-1.5 py-1 border border-slate-200 rounded-md bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <PriorityPicker value={priority} onChange={setPriority} />
        <button
          type="button"
          onClick={() => setLinkToBoard((v) => !v)}
          aria-pressed={linkToBoard}
          disabled={projects.length === 0}
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-md border disabled:opacity-40",
            linkToBoard ? "border-cyan-300 bg-cyan-50 text-cyan-700 font-medium" : "border-slate-200 hover:bg-white"
          )}
          title="Zusätzlich als Aufgabe im Projekt-Board anlegen"
        >
          <Link2 className="w-3.5 h-3.5" /> Board
        </button>
      </div>

      {linkToBoard && (
        <div className="grid grid-cols-2 gap-2">
          <select
            value={projectId}
            onChange={(e) => { setProjectId(e.target.value); setColumnId(""); }}
            className="px-2 py-1.5 border border-slate-200 rounded-md text-xs bg-white focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Projekt"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select
            value={effectiveColumnId}
            onChange={(e) => setColumnId(e.target.value)}
            className="px-2 py-1.5 border border-slate-200 rounded-md text-xs bg-white focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Spalte"
          >
            {columns.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1.5 rounded-md text-xs text-slate-600 hover:bg-white">
          Fertig
        </button>
        <button
          onClick={submit}
          disabled={!title.trim() || (!!customers && !customerId)}
          className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-semibold hover:opacity-90 disabled:opacity-40"
        >
          Hinzufügen
        </button>
      </div>
    </div>
  );
}
