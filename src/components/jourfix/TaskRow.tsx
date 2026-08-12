"use client";

import { useState } from "react";
import { Link2, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import type { JourfixTask, Profile } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  task: JourfixTask;
  profiles: Profile[];
  onToggleDone: (taskId: string, done: boolean) => void;
  onAssign: (taskId: string, assigneeId: string | null) => void;
  onUpdateDetails: (taskId: string, details: string) => void;
  onDelete: (taskId: string) => void;
}

const carryStyles: Record<number, string> = {
  1: "border-l-4 border-l-green-500 bg-green-50",
  2: "border-l-4 border-l-yellow-500 bg-yellow-50",
  3: "border-l-4 border-l-orange-500 bg-orange-50",
};
const carryStyleDefault = "border-l-4 border-l-red-500 bg-red-50";

export default function TaskRow({ task, profiles, onToggleDone, onAssign, onUpdateDetails, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [details, setDetails] = useState(task.details ?? "");
  const carryClass = task.carried_over_count > 0 ? (carryStyles[task.carried_over_count] ?? carryStyleDefault) : "border-l-4 border-l-transparent";

  function submitDetails() {
    if (details !== (task.details ?? "")) onUpdateDetails(task.id, details);
  }

  return (
    <div className={cn("rounded-md", carryClass)} title={task.carried_over_count > 0 ? `${task.carried_over_count}x übernommen` : undefined}>
      <div className="flex items-center gap-2 px-2 py-1.5">
        <input
          type="checkbox"
          checked={task.done}
          onChange={(e) => onToggleDone(task.id, e.target.checked)}
          className="w-4 h-4 shrink-0 accent-primary"
        />
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-muted-foreground hover:text-foreground shrink-0"
          title="Details"
        >
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
        <span className={cn("flex-1 text-sm truncate", task.done && "line-through text-muted-foreground")}>{task.title}</span>
        {task.linked_task && (
          <a
            href={`/projects/${task.linked_task.project_id}/board`}
            title={`Verknüpft mit Board-Aufgabe: ${task.linked_task.title}`}
            className="text-muted-foreground hover:text-primary shrink-0"
          >
            <Link2 className="w-3.5 h-3.5" />
          </a>
        )}
        <select
          value={task.assignee_id ?? ""}
          onChange={(e) => onAssign(task.id, e.target.value || null)}
          className="shrink-0 text-xs bg-transparent border rounded-md px-1.5 py-1 max-w-[110px] focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">–</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name}
            </option>
          ))}
        </select>
        <button
          onClick={() => { if (confirm(`Aufgabe "${task.title}" wirklich löschen?`)) onDelete(task.id); }}
          className="text-muted-foreground hover:text-destructive shrink-0"
          title="Aufgabe löschen"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="px-2 pb-2 pl-8">
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            onBlur={submitDetails}
            placeholder="Details hinzufügen..."
            rows={2}
            className="w-full px-2 py-1.5 border rounded-md text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          />
        </div>
      )}
    </div>
  );
}
