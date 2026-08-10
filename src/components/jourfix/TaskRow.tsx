"use client";

import { Link2 } from "lucide-react";
import type { JourfixTask, Profile } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  task: JourfixTask;
  profiles: Profile[];
  onToggleDone: (taskId: string, done: boolean) => void;
  onAssign: (taskId: string, assigneeId: string | null) => void;
}

const carryStyles: Record<number, string> = {
  1: "border-l-4 border-l-green-500 bg-green-50",
  2: "border-l-4 border-l-yellow-500 bg-yellow-50",
  3: "border-l-4 border-l-orange-500 bg-orange-50",
};
const carryStyleDefault = "border-l-4 border-l-red-500 bg-red-50";

export default function TaskRow({ task, profiles, onToggleDone, onAssign }: Props) {
  const carryClass = task.carried_over_count > 0 ? (carryStyles[task.carried_over_count] ?? carryStyleDefault) : "border-l-4 border-l-transparent";

  return (
    <div className={cn("flex items-center gap-2 px-2 py-1.5 rounded-md", carryClass)} title={task.carried_over_count > 0 ? `${task.carried_over_count}x übernommen` : undefined}>
      <input
        type="checkbox"
        checked={task.done}
        onChange={(e) => onToggleDone(task.id, e.target.checked)}
        className="w-4 h-4 shrink-0 accent-primary"
      />
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
    </div>
  );
}
