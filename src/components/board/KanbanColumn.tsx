"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import KanbanCard from "./KanbanCard";
import type { TaskColumn, Task, Profile } from "@/types";

interface Props {
  column: TaskColumn & { tasks: (Task & { profiles: Profile | null })[] };
  onAddTask: () => void;
  onCardClick: (task: Task) => void;
}

export default function KanbanColumn({ column, onAddTask, onCardClick }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div className="shrink-0 w-72 flex flex-col max-h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: column.color }} />
          <span className="font-medium text-sm">{column.title}</span>
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{column.tasks.length}</span>
        </div>
        <button onClick={onAddTask} className="p-1 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground transition">
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Cards */}
      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto rounded-xl transition-colors p-2 space-y-2 min-h-[100px] ${isOver ? "bg-primary/5 border-2 border-primary/30 border-dashed" : "bg-muted/30"}`}
      >
        <SortableContext items={column.tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {column.tasks.map((task) => (
            <KanbanCard key={task.id} task={task} onClick={() => onCardClick(task)} />
          ))}
        </SortableContext>
        {column.tasks.length === 0 && (
          <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
            Keine Aufgaben
          </div>
        )}
      </div>
    </div>
  );
}
