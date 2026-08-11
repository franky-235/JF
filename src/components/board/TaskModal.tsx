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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-slate-800">{isNew ? "Neue Aufgabe" : "Aufgabe bearbeiten"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-md transition text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Titel *</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none"
              onFocus={(e) => (e.target.style.boxShadow = "0 0 0 2px #00ffff30")}
              onBlur={(e) => (e.target.style.boxShadow = "")}
              placeholder="Aufgabentitel" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Beschreibung</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none resize-none"
              onFocus={(e) => (e.target.style.boxShadow = "0 0 0 2px #00ffff30")}
              onBlur={(e) => (e.target.style.boxShadow = "")}
              placeholder="Optionale Beschreibung..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Zuständig</label>
              <select value={form.assignee_id} onChange={(e) => setForm({ ...form, assignee_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none">
                <option value="">Nicht zugewiesen</option>
                {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Priorität</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none">
                <option value="low">Niedrig</option>
                <option value="medium">Mittel</option>
                <option value="high">Hoch</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Startdatum</label>
              <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none"
                onFocus={(e) => (e.target.style.boxShadow = "0 0 0 2px #00ffff30")}
                onBlur={(e) => (e.target.style.boxShadow = "")} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Fälligkeitsdatum</label>
              <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none"
                onFocus={(e) => (e.target.style.boxShadow = "0 0 0 2px #00ffff30")}
                onBlur={(e) => (e.target.style.boxShadow = "")} />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex items-center gap-3 mt-6">
          {!isNew && (
            <button onClick={handleDelete} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition">Abbrechen</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50"
            style={{ backgroundColor: "#00ffff", color: "#000000" }}
            onMouseEnter={(e) => !saving && ((e.currentTarget as HTMLElement).style.backgroundColor = "#00e5e5")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#00ffff")}
          >
            {saving ? "Speichern..." : "Speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}
