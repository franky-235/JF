"use client";

import { useMemo, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Kanban, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/toast";

export type BoardProjectOption = {
  id: string;
  name: string;
  task_columns: { id: string; title: string; position: number }[];
};

interface Props {
  kind: "jourfix" | "customer_item";
  id: string;
  projects: BoardProjectOption[];
  onLinked: (taskId: string) => void;
  className?: string;
}

/** Übernimmt eine Jourfix-Aufgabe oder einen Kundenpunkt als Aufgabe ins Projekt-Board. */
export default function BoardLinkButton({ kind, id, projects, onLinked, className }: Props) {
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [columnId, setColumnId] = useState("");
  const [saving, setSaving] = useState(false);

  const columns = useMemo(
    () => [...(projects.find((p) => p.id === projectId)?.task_columns ?? [])].sort((a, b) => a.position - b.position),
    [projects, projectId]
  );
  const effectiveColumnId = columnId || columns[0]?.id || "";

  async function submit() {
    if (!effectiveColumnId) return;
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("link_to_board", { p_kind: kind, p_id: id, p_column_id: effectiveColumnId });
    setSaving(false);
    if (error) { toast.error(`Übernahme ins Board fehlgeschlagen: ${error.message}`); return; }
    toast.success("Ins Board übernommen");
    setOpen(false);
    onLinked(data as string);
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={projects.length === 0}
          className={className ?? "flex items-center gap-1 text-xs text-slate-500 hover:text-cyan-700 disabled:opacity-40"}
          title={projects.length === 0 ? "Keine Projekte vorhanden" : "Als Aufgabe ins Board übernehmen"}
        >
          <Kanban className="w-3.5 h-3.5" /> Ins Board
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-50 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-xl focus:outline-none flex flex-col gap-2"
        >
          <p className="text-xs font-semibold text-slate-700">Ins Board übernehmen</p>
          <select
            value={projectId}
            onChange={(e) => { setProjectId(e.target.value); setColumnId(""); }}
            className="px-2 py-1.5 border border-slate-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Projekt"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select
            value={effectiveColumnId}
            onChange={(e) => setColumnId(e.target.value)}
            className="px-2 py-1.5 border border-slate-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Spalte"
          >
            {columns.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
          <button
            onClick={submit}
            disabled={saving || !effectiveColumnId}
            className="mt-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-semibold hover:opacity-90 disabled:opacity-40"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Übernehmen
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
