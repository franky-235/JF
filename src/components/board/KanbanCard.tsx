"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarDays, User } from "lucide-react";
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
}

export default function KanbanCard({ task, onClick, isDragging }: Props) {
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
        "bg-card border rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow select-none",
        isDragging && "shadow-xl rotate-2 scale-105"
      )}
    >
      <p className="text-sm font-medium mb-2 line-clamp-2">{task.title}</p>

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
            <div className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-semibold" title={task.profiles.full_name}>
              {task.profiles.full_name?.[0]?.toUpperCase() ?? "?"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
