"use client";

import { useMemo, useState } from "react";
import type { Profile } from "@/types";
import type { ProjectOption } from "./JourfixClient";

interface Props {
  profiles: Profile[];
  projects: ProjectOption[];
  onSubmit: (params: {
    title: string;
    assigneeId: string | null;
    linkToBoard: boolean;
    projectId?: string;
    columnId?: string;
  }) => void;
  onCancel: () => void;
}

export default function AddTaskForm({ profiles, projects, onSubmit, onCancel }: Props) {
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [linkToBoard, setLinkToBoard] = useState(false);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [columnId, setColumnId] = useState("");

  const columns = useMemo(() => {
    const project = projects.find((p) => p.id === projectId);
    return [...(project?.task_columns ?? [])].sort((a, b) => a.position - b.position);
  }, [projects, projectId]);

  const effectiveColumnId = columnId || columns[0]?.id || "";

  function submit() {
    if (!title.trim()) return;
    if (linkToBoard && (!projectId || !effectiveColumnId)) return;
    onSubmit({
      title: title.trim(),
      assigneeId: assigneeId || null,
      linkToBoard,
      projectId: linkToBoard ? projectId : undefined,
      columnId: linkToBoard ? effectiveColumnId : undefined,
    });
  }

  return (
    <div className="border rounded-lg p-2.5 flex flex-col gap-2 bg-background">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && submit()}
        placeholder="Neue Aufgabe..."
        className="w-full px-2 py-1.5 border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <select
        value={assigneeId}
        onChange={(e) => setAssigneeId(e.target.value)}
        className="w-full px-2 py-1.5 border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">Nicht zugewiesen</option>
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.full_name}
          </option>
        ))}
      </select>

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={linkToBoard} onChange={(e) => setLinkToBoard(e.target.checked)} className="accent-primary" />
        Auch als Aufgabe im Board anlegen
      </label>

      {linkToBoard && (
        <div className="grid grid-cols-2 gap-2">
          <select
            value={projectId}
            onChange={(e) => { setProjectId(e.target.value); setColumnId(""); }}
            className="px-2 py-1.5 border rounded-md text-xs bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={effectiveColumnId}
            onChange={(e) => setColumnId(e.target.value)}
            className="px-2 py-1.5 border rounded-md text-xs bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {columns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={submit} className="flex-1 py-1.5 bg-primary text-primary-foreground rounded-md text-xs hover:opacity-90">
          Speichern
        </button>
        <button onClick={onCancel} className="flex-1 py-1.5 border rounded-md text-xs hover:bg-accent">
          Abbrechen
        </button>
      </div>
    </div>
  );
}
