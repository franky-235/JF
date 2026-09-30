"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarDays, Check, User } from "lucide-react";
import type { Task, Profile } from "@/types";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";

const priorityColors = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-red-100 text-red-700",
};
const priorityLabels = { low: "Niedrig", medium: "Mittel", high: "Hoch" };

interface Props {
  task: Task & { profiles?: Profile | null };
  onClick?: () => void;
  isDragging?: boolean;
  done?: boolean;
  /** Ohne Handler (z.B. Projekt ohne Erledigt-Spalte) wird keine Checkbox angezeigt */
  onToggleDone?: () => void;
}

export default function KanbanCard({ task, onClick, isDragging, done = false, onToggleDone }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        "bg-white border border-slate-200 rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow select-none",
        isDragging && "shadow-xl rotate-2 scale-105"
      )}
    >
      <div className="flex items-start gap-2 mb-2">
        {onToggleDone && (
          <button
            role="checkbox"
            aria-checked={done}
            aria-label={done ? "Wieder öffnen" : "Als erledigt markieren"}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onToggleDone(); }}
            className={cn(
              "mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
              done ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 hover:border-cyan-500"
            )}
          >
            {done && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
          </button>
        )}
        <p className={cn("text-sm font-medium line-clamp-2", done && "line-through text-slate-400")}>{task.title}</p>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColors[task.priority]}`}>
          {priorityLabels[task.priority]}
        </span>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {task.due_date && (
            <span className="flex items-center gap-1">
              <CalendarDays className="w-3 h-3" />
              {format(new Date(task.due_date), "dd. MMM", { locale: de })}
            </span>
          )}
          {task.profiles && (
            task.profiles.avatar_url ? (
              <img
                src={task.profiles.avatar_url}
                alt={task.profiles.full_name}
                title={task.profiles.full_name}
                className="w-5 h-5 rounded-full object-cover"
              />
            ) : (
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold"
                style={{ backgroundColor: "#00ffff20", color: "#007777" }}
                title={task.profiles.full_name}
              >
                {task.profiles.full_name?.[0]?.toUpperCase() ?? "?"}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
