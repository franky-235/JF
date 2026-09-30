"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { CalendarClock, CalendarDays, Check, Loader2, Mail, Phone, Plus, Trash2, X } from "lucide-react";
import type { PipelineStage, Profile } from "@/types";
import { cn } from "@/lib/utils";
import { pipelineStages } from "@/lib/pipeline";
import BoardLinkButton, { type BoardProjectOption } from "@/components/BoardLinkButton";
import { AssigneePicker, InBoardBadge } from "@/components/jourfix/TaskRow";
import { formatDue, isOverdue } from "@/components/jourfix/utils";
import type { PipelineCustomer, PipelineItem } from "./PipelineClient";

interface Props {
  customer: PipelineCustomer;
  profiles: Profile[];
  projects: BoardProjectOption[];
  currentWeekId: string | null;
  onClose: () => void;
  onStageChange: (stage: PipelineStage) => void;
  onAddItem: (title: string, assigneeId: string | null, dueDate: string | null, showInJourfix: boolean) => Promise<void>;
  onUpdateItem: (itemId: string, patch: Partial<Pick<PipelineItem, "title" | "done" | "assignee_id" | "due_date">>) => void;
  onDeleteItem: (item: PipelineItem) => void;
  onToggleJourfix: (item: PipelineItem, on: boolean) => Promise<void>;
  onReloadItem: (itemId: string) => void;
}

export default function CustomerPanel({
  customer,
  profiles,
  projects,
  currentWeekId,
  onClose,
  onStageChange,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onToggleJourfix,
  onReloadItem,
}: Props) {
  const [showDone, setShowDone] = useState(false);
  const items = [...(customer.customer_items ?? [])].sort(
    (a, b) => Number(a.done) - Number(b.done) || a.position - b.position || a.created_at.localeCompare(b.created_at)
  );
  const open = items.filter((i) => !i.done);
  const visible = showDone ? items : open;

  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/30" />
        <Dialog.Content className="fixed right-0 top-0 bottom-0 z-40 w-full max-w-xl bg-white shadow-2xl flex flex-col focus:outline-none">
          <div className="px-6 pt-5 pb-4 border-b border-slate-100">
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center font-semibold shrink-0"
                style={{ backgroundColor: "#00ffff20", color: "#007777" }}
              >
                {(customer.company || customer.name || "?").charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <Dialog.Title className="text-lg font-semibold text-slate-800 truncate">{customer.name}</Dialog.Title>
                <Dialog.Description className="text-sm text-slate-500 truncate">
                  {customer.company || "Kein Firmenname"}
                </Dialog.Description>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                  {customer.email && (
                    <a href={`mailto:${customer.email}`} className="flex items-center gap-1 hover:text-cyan-700">
                      <Mail className="w-3 h-3" /> {customer.email}
                    </a>
                  )}
                  {customer.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {customer.phone}
                    </span>
                  )}
                </div>
              </div>
              <Dialog.Close className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100" aria-label="Schließen">
                <X className="w-4 h-4" />
              </Dialog.Close>
            </div>

            <div className="mt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Phase</p>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Pipeline-Phase">
                {pipelineStages.map((s) => {
                  const active = customer.pipeline_stage === s.id;
                  return (
                    <button
                      key={s.id}
                      role="radio"
                      aria-checked={active}
                      onClick={() => !active && onStageChange(s.id)}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-colors",
                        active ? cn(s.badge, "border-transparent font-semibold") : "border-slate-200 text-slate-500 hover:bg-slate-50"
                      )}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 px-6 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700">Offene Punkte</h3>
            <span className="text-xs text-slate-500 tabular-nums">{open.length}</span>
            <label className="ml-auto flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
              <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} className="accent-cyan-500" />
              Erledigte anzeigen
            </label>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="divide-y divide-slate-100">
              {visible.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  profiles={profiles}
                  projects={projects}
                  inCurrentWeek={!!currentWeekId && (item.jourfix_tasks ?? []).some((j) => j.week_id === currentWeekId)}
                  onUpdate={(patch) => onUpdateItem(item.id, patch)}
                  onDelete={() => onDeleteItem(item)}
                  onToggleJourfix={(on) => onToggleJourfix(item, on)}
                  onLinked={() => onReloadItem(item.id)}
                />
              ))}
            </div>
            {visible.length === 0 && (
              <p className="px-6 py-10 text-center text-sm text-slate-400">
                {items.length === 0 ? "Noch keine Punkte für diesen Kunden." : "Keine offenen Punkte 🎉"}
              </p>
            )}
          </div>

          <NewItemForm profiles={profiles} onAdd={onAddItem} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ItemRow({
  item,
  profiles,
  projects,
  inCurrentWeek,
  onUpdate,
  onDelete,
  onToggleJourfix,
  onLinked,
}: {
  item: PipelineItem;
  profiles: Profile[];
  projects: BoardProjectOption[];
  inCurrentWeek: boolean;
  onUpdate: (patch: Partial<Pick<PipelineItem, "title" | "done" | "assignee_id" | "due_date">>) => void;
  onDelete: () => void;
  onToggleJourfix: (on: boolean) => Promise<void>;
  onLinked: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [adding, setAdding] = useState(false);
  useEffect(() => {
    if (!editing) setTitle(item.title);
  }, [item.title, editing]);

  function submit() {
    setEditing(false);
    const next = title.trim();
    if (!next) { setTitle(item.title); return; }
    if (next !== item.title) onUpdate({ title: next });
  }

  const assignee = profiles.find((p) => p.id === item.assignee_id) ?? null;
  const overdue = isOverdue(item);

  return (
    <div className="group px-6 py-2.5 hover:bg-slate-50/70">
      <div className="flex items-center gap-2.5">
        <button
          role="checkbox"
          aria-checked={item.done}
          aria-label={item.done ? "Als offen markieren" : "Als erledigt markieren"}
          onClick={() => onUpdate({ done: !item.done })}
          className={cn(
            "w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
            item.done ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 hover:border-cyan-500"
          )}
        >
          {item.done && <Check className="w-3 h-3" strokeWidth={3} />}
        </button>
        {editing ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={submit}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") { setTitle(item.title); setEditing(false); }
            }}
            className="flex-1 min-w-0 px-1.5 py-0.5 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className={cn("flex-1 min-w-0 text-left text-sm truncate cursor-text", item.done ? "line-through text-slate-400" : "text-slate-800")}
          >
            {item.title}
          </button>
        )}
        <AssigneePicker assignee={assignee} profiles={profiles} onChange={(id) => onUpdate({ assignee_id: id })} />
        <button
          onClick={onDelete}
          className="p-1 rounded-md text-slate-300 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          aria-label="Punkt löschen"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="mt-1.5 pl-[28px] flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
        <label className={cn("flex items-center gap-1", overdue ? "text-red-600" : "text-slate-500")}>
          <CalendarDays className="w-3.5 h-3.5" />
          <input
            type="date"
            value={item.due_date ?? ""}
            onChange={(e) => onUpdate({ due_date: e.target.value || null })}
            className="bg-transparent border-0 p-0 text-xs focus:outline-none focus:ring-0 w-[110px]"
            aria-label="Fällig am"
          />
          {item.due_date && overdue && <span className="font-medium">überfällig</span>}
        </label>

        <label
          className={cn(
            "inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-full border cursor-pointer select-none",
            item.show_in_jourfix ? "border-indigo-200 bg-indigo-50 text-indigo-700 font-medium" : "border-slate-200 text-slate-500 hover:text-indigo-700",
            adding && "opacity-50 pointer-events-none"
          )}
          title="Punkt automatisch im Kundenbereich des Jour Fixe anzeigen, bis er erledigt ist"
        >
          {adding ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <input
              type="checkbox"
              checked={item.show_in_jourfix}
              onChange={async (e) => { setAdding(true); await onToggleJourfix(e.target.checked); setAdding(false); }}
              className="accent-indigo-500 w-3 h-3"
            />
          )}
          In JF anzeigen
        </label>
        {item.show_in_jourfix && inCurrentWeek && (
          <Link href="/jourfix" className="inline-flex items-center gap-1 text-indigo-600 hover:underline" title="Zum Jour Fixe">
            <CalendarClock className="w-3 h-3" /> öffnen
          </Link>
        )}

        {item.linked_task ? (
          <InBoardBadge projectId={item.linked_task.project_id} title={item.linked_task.title} />
        ) : (
          !item.done && <BoardLinkButton kind="customer_item" id={item.id} projects={projects} onLinked={onLinked} />
        )}
      </div>
    </div>
  );
}

function NewItemForm({
  profiles,
  onAdd,
}: {
  profiles: Profile[];
  onAdd: (title: string, assigneeId: string | null, dueDate: string | null, showInJourfix: boolean) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [showInJourfix, setShowInJourfix] = useState(false);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!title.trim() || saving) return;
    setSaving(true);
    await onAdd(title.trim(), assigneeId, dueDate || null, showInJourfix);
    setSaving(false);
    setTitle("");
  }

  return (
    <div className="border-t border-slate-200 px-6 py-3 bg-slate-50 flex flex-wrap items-center gap-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Neuer offener Punkt…"
        className="flex-1 min-w-0 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <input
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        className="hidden sm:block px-2 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label="Fällig am"
      />
      <AssigneePicker assignee={profiles.find((p) => p.id === assigneeId) ?? null} profiles={profiles} onChange={setAssigneeId} size={28} />
      <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none" title="Automatisch im Kundenbereich des Jour Fixe anzeigen">
        <input type="checkbox" checked={showInJourfix} onChange={(e) => setShowInJourfix(e.target.checked)} className="accent-indigo-500" />
        In JF anzeigen
      </label>
      <button
        onClick={submit}
        disabled={!title.trim() || saving}
        className="flex items-center gap-1 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-40"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        Hinzufügen
      </button>
    </div>
  );
}
