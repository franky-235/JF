"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { JourfixArea, JourfixTask, Profile } from "@/types";
import type { ProjectOption } from "./JourfixClient";
import TaskRow from "./TaskRow";
import AddTaskForm from "./AddTaskForm";

interface Props {
  area: JourfixArea;
  tasks: JourfixTask[];
  profiles: Profile[];
  projects: ProjectOption[];
  isAdmin: boolean;
  onRename: (name: string) => void;
  onDeleteArea: () => void;
  onToggleDone: (taskId: string, done: boolean) => void;
  onAssign: (taskId: string, assigneeId: string | null) => void;
  onUpdateTaskDetails: (taskId: string, details: string) => void;
  onDeleteTask: (taskId: string) => void;
  onAddTask: (params: {
    title: string;
    assigneeId: string | null;
    linkToBoard: boolean;
    projectId?: string;
    columnId?: string;
  }) => void;
}

export default function AreaCard({ area, tasks, profiles, projects, isAdmin, onRename, onDeleteArea, onToggleDone, onAssign, onUpdateTaskDetails, onDeleteTask, onAddTask }: Props) {
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(area.name);
  const [showAddTask, setShowAddTask] = useState(false);

  function submitRename() {
    if (name.trim() && name.trim() !== area.name) onRename(name.trim());
    setEditingName(false);
  }

  const openCount = tasks.filter((t) => !t.done).length;

  return (
    <div className="bg-card border rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        {editingName ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={submitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitRename();
              if (e.key === "Escape") { setName(area.name); setEditingName(false); }
            }}
            className="flex-1 px-2 py-1 border rounded-md text-sm font-semibold bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        ) : (
          <h3 className="font-semibold text-sm flex items-center gap-1.5 min-w-0">
            <span className="truncate">{area.name}</span>
            {isAdmin && (
              <button onClick={() => setEditingName(true)} className="text-muted-foreground hover:text-foreground shrink-0">
                <Pencil className="w-3 h-3" />
              </button>
            )}
          </h3>
        )}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground">{openCount}/{tasks.length}</span>
          {isAdmin && (
            <button
              onClick={() => { if (confirm(`Bereich "${area.name}" wirklich löschen? Alle Aufgaben darin (in allen Wochen) werden entfernt.`)) onDeleteArea(); }}
              className="text-muted-foreground hover:text-destructive"
              title="Bereich löschen"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            profiles={profiles}
            onToggleDone={onToggleDone}
            onAssign={onAssign}
            onUpdateDetails={onUpdateTaskDetails}
            onDelete={onDeleteTask}
          />
        ))}
        {tasks.length === 0 && !showAddTask && (
          <p className="text-xs text-muted-foreground py-1">Keine Aufgaben</p>
        )}
      </div>

      {showAddTask ? (
        <AddTaskForm
          profiles={profiles}
          projects={projects}
          onSubmit={(params) => {
            onAddTask(params);
            setShowAddTask(false);
          }}
          onCancel={() => setShowAddTask(false)}
        />
      ) : (
        <button
          onClick={() => setShowAddTask(true)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition self-start"
        >
          <Plus className="w-3.5 h-3.5" /> Aufgabe hinzufügen
        </button>
      )}
    </div>
  );
}
