"use client";

import { useState } from "react";
import { X, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Task, Profile } from "@/types";

interface Props {
  task: Task | null;
  columnId: string;
  projectId: string;
  profiles: Profile[];
  onSave: (task: Task, isNew: boolean) => void;
  onDelete: (taskId: string) => void;
  onClose: () => void;
}

export default function TaskModal({ task, columnId, projectId, profiles, onSave, onDelete, onClose }: Props) {
  const isNew = !task;
  const [form, setForm] = useState({
    title: task?.title ?? "",
    description: task?.description ?? "",
    assignee_id: task?.assignee_id ?? "",
    priority: task?.priority ?? "medium",
    due_date: task?.due_date ?? "",
    start_date: task?.start_date ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!form.title.trim()) { setError("Titel ist erforderlich."); return; }
    setSaving(true);
    const supabase = createClient();
    const payload = {
      title: form.title,
      description: form.description || null,
      assignee_id: form.assignee_id || null,
      priority: form.priority,
      due_date: form.due_date || null,
      start_date: form.start_date || null,
    };

    if (isNew) {
      const { data, error } = await supabase.from("tasks").insert({
        ...payload, project_id: projectId, column_id: columnId, position: 9999
      }).select().single();
      if (error) { setError(error.message); setSaving(false); return; }
      onSave(data, true);
    } else {
      const { data, error } = await supabase.from("tasks").update(payload).eq("id", task.id).select().single();
      if (error) { setError(error.message); setSaving(false); return; }
      onSave(data, false);
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!task || !confirm("Aufgabe wirklich löschen?")) return;
    const supabase = createClient();
    await supabase.from("tasks").delete().eq("id", task.id);
    onDelete(task.id);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">{isNew ? "Neue Aufgabe" : "Aufgabe bearbeiten"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded-md transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Titel *</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Aufgabentitel" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Beschreibung</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3} className="w-full px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" placeholder="Optionale Beschreibung..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Zuständig</label>
              <select value={form.assignee_id} onChange={(e) => setForm({ ...form, assignee_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">Nicht zugewiesen</option>
                {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Priorität</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as any })}
                className="w-full px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="low">Niedrig</option>
                <option value="medium">Mittel</option>
                <option value="high">Hoch</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Startdatum</label>
              <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Fälligkeitsdatum</label>
              <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="flex items-center gap-3 mt-6">
          {!isNew && (
            <button onClick={handleDelete} className="p-2 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg transition">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button onClick={onClose} className="flex-1 py-2 border rounded-lg text-sm hover:bg-accent transition">Abbrechen</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 transition disabled:opacity-50">
            {saving ? "Speichern..." : "Speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}
