"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Calendar, X, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Project, Customer } from "@/types";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface Props {
  projects: (Project & {
    customers: { id: string; name: string; company: string | null } | null;
    taskCount?: number;
    doneCount?: number;
  })[];
  customers: Pick<Customer, "id" | "name" | "company">[];
}

interface ProjectForm {
  name: string;
  description: string;
  customer_id: string;
  status: string;
  color: string;
}

const COLORS = [
  "#6366F1", "#0EA5E9", "#10B981", "#F59E0B",
  "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6",
  "#F97316", "#84CC16",
];

const emptyForm: ProjectForm = {
  name: "", description: "", customer_id: "", status: "active", color: COLORS[0],
};

const statusConfig: Record<string, { label: string; classes: string }> = {
  active: { label: "Aktiv", classes: "bg-emerald-100 text-emerald-700" },
  completed: { label: "Abgeschlossen", classes: "bg-slate-100 text-slate-600" },
  archived: { label: "Archiviert", classes: "bg-gray-100 text-gray-500" },
  planning: { label: "Planung", classes: "bg-blue-100 text-blue-700" },
  "on-hold": { label: "Pausiert", classes: "bg-amber-100 text-amber-700" },
};

export default function ProjectsClient({ projects: initial, customers }: Props) {
  const [projects, setProjects] = useState(initial);
  const [showModal, setShowModal] = useState(false);
  const [editProject, setEditProject] = useState<(typeof initial)[0] | null>(null);
  const [form, setForm] = useState<ProjectForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function openCreate() {
    setEditProject(null);
    setForm({ ...emptyForm, color: COLORS[projects.length % COLORS.length] });
    setError("");
    setShowModal(true);
  }

  function openEdit(p: (typeof initial)[0]) {
    setEditProject(p);
    setForm({
      name: p.name,
      description: p.description ?? "",
      customer_id: p.customer_id ?? "",
      status: p.status,
      color: (p as any).color || COLORS[0],
    });
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
      color: form.color,
    };

    if (editProject) {
      const { data, error } = await supabase
        .from("projects")
        .update(payload)
        .eq("id", editProject.id)
        .select("*, customers(id, name, company)")
        .single();
      if (error) { setError(error.message); setSaving(false); return; }
      setProjects((prev) => prev.map((p) => p.id === editProject.id ? { ...p, ...data } : p));
    } else {
      const { data, error } = await supabase
        .from("projects")
        .insert(payload)
        .select("*, customers(id, name, company)")
        .single();
      if (error) { setError(error.message); setSaving(false); return; }
      // Create default task columns
      await supabase.from("task_columns").insert([
        { project_id: data.id, title: "Backlog", position: 0, color: "#94a3b8" },
        { project_id: data.id, title: "To Do", position: 1, color: "#6366f1" },
        { project_id: data.id, title: "In Bearbeitung", position: 2, color: "#f59e0b" },
        { project_id: data.id, title: "Review", position: 3, color: "#8b5cf6" },
        { project_id: data.id, title: "Erledigt", position: 4, color: "#10b981" },
      ]);
      setProjects((prev) => [{ ...data, taskCount: 0, doneCount: 0 }, ...prev]);
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

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Projekte</h1>
          <p className="text-sm text-slate-500">{projects.length} Projekte</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          style={{ backgroundColor: "#00ffff", color: "#000000" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#00e5e5")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#00ffff")}
        >
          <Plus className="w-4 h-4" /> Neues Projekt
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {projects.map((p) => {
          const color = (p as any).color || COLORS[0];
          const s = statusConfig[p.status] ?? statusConfig.active;
          const taskCount = p.taskCount ?? 0;
          const doneCount = p.doneCount ?? 0;
          const pct = taskCount > 0 ? Math.round((doneCount / taskCount) * 100) : 0;

          return (
            <div key={p.id} className="bg-white rounded-xl border border-slate-200 hover:shadow-md transition-all overflow-hidden">
              {/* Color bar */}
              <div className="h-1.5" style={{ backgroundColor: color }} />
              <div className="p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                      style={{ backgroundColor: color }}
                    >
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-slate-800">{p.name}</h3>
                      {p.customers?.name && (
                        <p className="text-xs text-slate-400">{p.customers.name}</p>
                      )}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${s.classes}`}>
                    {s.label}
                  </span>
                </div>

                {p.description && (
                  <p className="text-sm text-slate-500 mb-4 leading-relaxed line-clamp-2">{p.description}</p>
                )}

                {/* Progress */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                    <span>Fortschritt</span>
                    <span className="font-medium">{doneCount}/{taskCount} Aufgaben ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                </div>

                <div className="flex items-center text-xs text-slate-400 mb-4">
                  <Calendar className="w-3.5 h-3.5 mr-1" />
                  {format(new Date(p.created_at), "d. MMM yyyy", { locale: de })}
                </div>

                <div className="flex gap-2 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => openEdit(p)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
                  >
                    <Pencil className="w-3 h-3" /> Bearbeiten
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="px-3 py-1.5 text-xs text-red-500 border border-red-100 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Add placeholder */}
        <button
          onClick={openCreate}
          className="border-2 border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center gap-3 text-slate-400 hover:text-slate-600 transition-all min-h-[200px]"
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "#00ffff")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "")}
        >
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
            <Plus className="w-6 h-6" />
          </div>
          <span className="text-sm font-medium">Neues Projekt erstellen</span>
        </button>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-slate-800">
                {editProject ? "Projekt bearbeiten" : "Neues Projekt"}
              </h2>
              <button onClick={() => setShowModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Projektname *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="z.B. Website Relaunch"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Beschreibung</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                  placeholder="Kurze Projektbeschreibung..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none"
                  >
                    <option value="planning">Planung</option>
                    <option value="active">Aktiv</option>
                    <option value="on-hold">Pausiert</option>
                    <option value="completed">Abgeschlossen</option>
                    <option value="archived">Archiviert</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Kunde</label>
                  <select
                    value={form.customer_id}
                    onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none"
                  >
                    <option value="">Kein Kunde</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ""}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-2 block">Projektfarbe</label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setForm({ ...form, color: c })}
                      className={`w-7 h-7 rounded-full transition-all ${form.color === c ? "ring-2 ring-offset-2 ring-slate-400 scale-110" : "hover:scale-105"}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
                Abbrechen
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2 text-sm rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ backgroundColor: "#00ffff", color: "#000000" }}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
