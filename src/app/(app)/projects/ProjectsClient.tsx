"use client";

import { useState } from "react";
import { Plus, FolderKanban, Pencil, Trash2, Calendar } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Project, Customer } from "@/types";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface Props {
  projects: (Project & {
    customers: { id: string; name: string; company: string | null } | null;
    taskCount?: number;
    doneCount?: number;
    memberCount?: number;
  })[];
  customers: Pick<Customer, "id" | "name" | "company">[];
}

interface ProjectForm {
  name: string;
  description: string;
  customer_id: string;
  status: string;
  start_date: string;
  end_date: string;
}

const emptyForm: ProjectForm = { name: "", description: "", customer_id: "", status: "active", start_date: "", end_date: "" };

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  active: { label: "Aktiv", bg: "bg-emerald-100", text: "text-emerald-700" },
  completed: { label: "Abgeschlossen", bg: "bg-blue-100", text: "text-blue-700" },
  archived: { label: "Archiviert", bg: "bg-gray-100", text: "text-gray-600" },
  planning: { label: "Planung", bg: "bg-violet-100", text: "text-violet-700" },
};

const projectColors = ["#6366f1", "#22d3ee", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function ProjectsClient({ projects: initial, customers }: Props) {
  const [projects, setProjects] = useState(initial);
  const [showModal, setShowModal] = useState(false);
  const [editProject, setEditProject] = useState<(typeof initial)[0] | null>(null);
  const [form, setForm] = useState<ProjectForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function openCreate() {
    setEditProject(null);
    setForm(emptyForm);
    setError("");
    setShowModal(true);
  }

  function openEdit(p: (typeof initial)[0]) {
    setEditProject(p);
    setForm({ name: p.name, description: p.description ?? "", customer_id: p.customer_id ?? "", status: p.status, start_date: "", end_date: "" });
    setError("");
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { setError("Projektname ist erforderlich."); return; }
    setSaving(true);
    const supabase = createClient();
    const payload = {
      name: form.name,
      description: form.description || null,
      customer_id: form.customer_id || null,
      status: form.status,
    };

    if (editProject) {
      const { data, error } = await supabase.from("projects").update(payload).eq("id", editProject.id).select("*, customers(id, name, company)").single();
      if (error) { setError(error.message); setSaving(false); return; }
      setProjects((prev) => prev.map((p) => p.id === editProject.id ? { ...p, ...data } : p));
    } else {
      const { data, error } = await supabase.from("projects").insert(payload).select("*, customers(id, name, company)").single();
      if (error) { setError(error.message); setSaving(false); return; }
      await supabase.from("task_columns").insert([
        { project_id: data.id, title: "Backlog", position: 0, color: "#94a3b8" },
        { project_id: data.id, title: "To Do", position: 1, color: "#6366f1" },
        { project_id: data.id, title: "In Bearbeitung", position: 2, color: "#f59e0b" },
        { project_id: data.id, title: "Review", position: 3, color: "#8b5cf6" },
        { project_id: data.id, title: "Erledigt", position: 4, color: "#10b981" },
      ]);
      setProjects((prev) => [{ ...data, taskCount: 0, doneCount: 0, memberCount: 0 }, ...prev]);
    }
    setSaving(false);
    setShowModal(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Projekt und alle Aufgaben wirklich löschen?")) return;
    const supabase = createClient();
    await supabase.from("projects").delete().eq("id", id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }

  const activeCount = projects.filter((p) => p.status === "active").length;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Projekte</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{activeCount} aktive Projekte</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition"
        >
          <Plus className="w-4 h-4" /> Neues Projekt
        </button>
      </div>

      {/* Projects grid */}
      <div className="grid grid-cols-2 gap-4">
        {projects.length === 0 && (
          <div className="col-span-2 text-center py-16 text-muted-foreground border rounded-xl bg-card">
            <FolderKanban className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Noch keine Projekte. Erstelle dein erstes Projekt!</p>
          </div>
        )}

        {projects.map((p, i) => {
          const color = projectColors[i % projectColors.length];
          const s = statusConfig[p.status] ?? statusConfig.active;
          const taskCount = p.taskCount ?? 0;
          const doneCount = p.doneCount ?? 0;
          const pct = taskCount > 0 ? Math.round((doneCount / taskCount) * 100) : 0;
          const initial = p.name[0]?.toUpperCase() ?? "P";

          return (
            <div
              key={p.id}
              className="bg-card border rounded-xl overflow-hidden hover:shadow-md transition-shadow"
              style={{ borderTop: `3px solid ${color}` }}
            >
              <div className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white text-sm shrink-0"
                      style={{ background: color }}
                    >
                      {initial}
                    </div>
                    <div>
                      <h2 className="font-semibold text-sm">{p.name}</h2>
                      {p.customers?.name && (
                        <p className="text-xs text-muted-foreground">{p.customers.name}</p>
                      )}
                    </div>
                  </div>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium shrink-0 ${s.bg} ${s.text}`}>
                    {s.label}
                  </span>
                </div>

                {/* Description */}
                {p.description && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{p.description}</p>
                )}

                {/* Progress */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                    <span>Fortschritt</span>
                    <span>{doneCount}/{taskCount} Aufgaben ({pct}%)</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: color }}
                    />
                  </div>
                </div>

                {/* Footer meta */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      {format(new Date(p.created_at), "d. MMM yyyy", { locale: de })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex border-t">
                <button
                  onClick={() => openEdit(p)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs text-muted-foreground hover:bg-accent transition-colors border-r"
                >
                  <Pencil className="w-3.5 h-3.5" /> Bearbeiten
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="px-4 py-2.5 text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}

        {/* New project ghost card */}
        <button
          onClick={openCreate}
          className="border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors min-h-[160px]"
        >
          <Plus className="w-6 h-6" />
          <span className="text-sm">Neues Projekt erstellen</span>
        </button>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-5">{editProject ? "Projekt bearbeiten" : "Neues Projekt"}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Projektname *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Website Relaunch" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Beschreibung</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" placeholder="Kurze Projektbeschreibung..." />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Kunde</label>
                <select value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="">Kein Kunde</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ""}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="active">Aktiv</option>
                  <option value="planning">Planung</option>
                  <option value="completed">Abgeschlossen</option>
                  <option value="archived">Archiviert</option>
                </select>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 border rounded-lg text-sm hover:bg-accent transition">Abbrechen</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 transition disabled:opacity-50">
                {saving ? "Speichern..." : "Speichern"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
