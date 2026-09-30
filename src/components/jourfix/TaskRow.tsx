"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as Popover from "@radix-ui/react-popover";
import {
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  GripVertical,
  MessageSquareText,
  RotateCw,
  Trash2,
  UserRound,
} from "lucide-react";
import type { JourfixNote, JourfixTask, JourfixWeek, Profile } from "@/types";
import Avatar from "@/components/Avatar";
import BoardLinkButton from "@/components/BoardLinkButton";
import { cn } from "@/lib/utils";
import NotesTimeline from "./NotesTimeline";
import { carryMeta, colWidths, formatDue, isOverdue, priorityMeta, type Priority, type ProjectOption } from "./utils";

export type TaskPatch = Partial<Pick<JourfixTask, "topic" | "title" | "assignee_id" | "due_date" | "priority">>;

export type NoteHandlers = {
  onAddNote: (task: JourfixTask, kind: JourfixNote["kind"], content: string) => Promise<boolean>;
  onUpdateNote: (noteId: string, content: string) => void;
  onDeleteNote: (note: JourfixNote) => void;
};

interface Props {
  task: JourfixTask;
  profiles: Profile[];
  projects: ProjectOption[];
  sortable: boolean;
  onToggleDone: (taskId: string, done: boolean) => void;
  onUpdate: (taskId: string, patch: TaskPatch) => void;
  onDelete: (task: JourfixTask) => void;
  onLinked: (taskId: string) => void;
  notes: JourfixNote[];
  weeks: JourfixWeek[];
  currentUserId: string | null;
  isAdmin: boolean;
  noteHandlers: NoteHandlers;
  /** "customer": erste Spalte = Kunde (Kategorie „Kunden“), sonst Thema */
  variant: "topic" | "customer";
  /** In „Abgeschlossen“: ursprüngliche Kategorie anzeigen */
  areaLabel?: string;
  topicSuggestions: string[];
  customers: { id: string; name: string }[];
  onChangeCustomer: (task: JourfixTask, customerId: string) => void;
  /** Haken „In Pipeline bearbeiten“ (nur Kategorie „Kunden“) */
  onTogglePipeline: (task: JourfixTask, on: boolean) => void;
}

export default function TaskRow({
  task,
  profiles,
  projects,
  sortable,
  onToggleDone,
  onUpdate,
  onDelete,
  onLinked,
  notes,
  weeks,
  currentUserId,
  isAdmin,
  noteHandlers,
  variant,
  areaLabel,
  topicSuggestions,
  customers,
  onChangeCustomer,
  onTogglePipeline,
}: Props) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", areaId: task.area_id },
    disabled: !sortable,
  });

  const [expanded, setExpanded] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(task.title);

  useEffect(() => {
    if (!editingTitle) setTitle(task.title);
  }, [task.title, editingTitle]);

  const carry = carryMeta(task.carried_over_count);
  const overdue = isOverdue(task);
  const assignee = profiles.find((p) => p.id === task.assignee_id) ?? null;

  function submitTitle() {
    const next = title.trim();
    setEditingTitle(false);
    if (!next) { setTitle(task.title); return; }
    if (next !== task.title) onUpdate(task.id, { title: next });
  }

  const lastNote = notes[notes.length - 1];

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("group relative bg-white", isDragging && "z-10 opacity-40")}
    >
      {carry && <span className={cn("absolute left-0 top-2 bottom-2 w-1 rounded-r-full", carry.bar)} aria-hidden />}

      <div className="flex items-center gap-2 pl-3 pr-2 py-2 min-h-[44px] hover:bg-slate-50/70">
        {sortable ? (
          <button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            className="p-0.5 -ml-1 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 focus-visible:opacity-100 touch-none shrink-0"
            aria-label="Aufgabe verschieben"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
        ) : (
          <span className="w-3 shrink-0" />
        )}

        <button
          role="checkbox"
          aria-checked={task.done}
          aria-label={task.done ? "Als offen markieren" : "Als erledigt markieren"}
          onClick={() => onToggleDone(task.id, !task.done)}
          className={cn(
            "w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
            task.done ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 hover:border-cyan-500"
          )}
        >
          {task.done && <Check className="w-3 h-3" strokeWidth={3} />}
        </button>

        {/* Thema bzw. Kunde */}
        <div className={cn(colWidths.lead, "shrink-0 min-w-0 pl-1")}>
          {areaLabel && (
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400 truncate">{areaLabel}</span>
          )}
          {variant === "customer" ? (
            <CustomerPicker task={task} customers={customers} onChange={(id) => onChangeCustomer(task, id)} />
          ) : (
            <TopicField
              value={task.topic}
              suggestions={topicSuggestions}
              done={task.done}
              onChange={(topic) => onUpdate(task.id, { topic })}
            />
          )}
        </div>

        {/* Aufgabe bzw. ToDo */}
        <div className="flex-1 min-w-0 flex items-center gap-2 pl-1">
          {editingTitle ? (
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={submitTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitTitle();
                if (e.key === "Escape") { setTitle(task.title); setEditingTitle(false); }
              }}
              className="flex-1 min-w-0 px-1.5 py-0.5 -my-0.5 border border-slate-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ring"
            />
          ) : (
            <button
              onClick={() => setEditingTitle(true)}
              title="Titel bearbeiten"
              className={cn(
                "min-w-0 text-left text-sm truncate cursor-text",
                task.done ? "line-through text-slate-400" : "text-slate-800"
              )}
            >
              {task.title}
            </button>
          )}
          {!editingTitle && (
            <div className="flex items-center gap-1 shrink-0">
              {variant === "customer" && (
                <PipelineToggle
                  on={!!task.customer_item_id}
                  disabled={!(task.customer_id ?? task.customer_item?.customer_id)}
                  onChange={(on) => onTogglePipeline(task, on)}
                />
              )}
              {notes.length > 0 && (
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className={cn(
                    "flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded-full font-medium tabular-nums",
                    lastNote?.kind === "decision" ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                  title={`${notes.length} ${notes.length === 1 ? "Eintrag" : "Einträge"} im Verlauf${lastNote ? ` – zuletzt: ${lastNote.content.slice(0, 80)}` : ""}`}
                  aria-label={`${notes.length} Notizen anzeigen`}
                >
                  <MessageSquareText className="w-3 h-3" />
                  {notes.length}
                </button>
              )}
              {carry && (
                <span
                  className={cn("flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium", carry.badge)}
                  title={`${task.carried_over_count}× in die Folgewoche übernommen`}
                >
                  <RotateCw className="w-2.5 h-2.5" />
                  {task.carried_over_count}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Zuständig */}
        <div className={cn(colWidths.assignee, "shrink-0 flex items-center")}>
          <AssigneePicker
            assignee={assignee}
            profiles={profiles}
            onChange={(id) => onUpdate(task.id, { assignee_id: id })}
            showName
          />
        </div>

        {/* Fällig */}
        <div className={cn(colWidths.due, "shrink-0 hidden sm:block")}>
          {task.due_date ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full",
                overdue ? "bg-red-50 text-red-600 font-medium" : "text-slate-500"
              )}
              title={overdue ? "Überfällig" : "Fällig"}
            >
              <CalendarDays className="w-3 h-3" />
              {formatDue(task.due_date)}
            </span>
          ) : (
            <span className="text-xs text-slate-300">–</span>
          )}
        </div>

        {/* Priorität */}
        <div className={cn(colWidths.priority, "shrink-0 hidden md:block")}>
          <span className={cn("inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full", priorityMeta[task.priority].className)}>
            <span className={cn("w-1.5 h-1.5 rounded-full", priorityMeta[task.priority].dot)} />
            {priorityMeta[task.priority].label}
          </span>
        </div>

        {/* Board */}
        <div className={cn(colWidths.board, "shrink-0 hidden md:block")}>
          {task.linked_task ? <InBoardBadge projectId={task.linked_task.project_id} title={task.linked_task.title} /> : null}
        </div>

        <button
          onClick={() => setExpanded((v) => !v)}
          className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 shrink-0"
          aria-expanded={expanded}
          aria-label="Details"
        >
          <ChevronDown className={cn("w-4 h-4 transition-transform", expanded && "rotate-180")} />
        </button>
      </div>

      {expanded && (
        <div className="pl-12 pr-4 pb-4 bg-slate-50/50 border-t border-slate-100">
          <div className="pt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
            <label className="flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5" />
              <input
                type="date"
                value={task.due_date ?? ""}
                onChange={(e) => onUpdate(task.id, { due_date: e.target.value || null })}
                className="px-1.5 py-1 border border-slate-200 rounded-md bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <PriorityPicker value={task.priority} onChange={(priority) => onUpdate(task.id, { priority })} />
            {task.linked_task ? (
              <InBoardBadge projectId={task.linked_task.project_id} title={task.linked_task.title} />
            ) : (
              <BoardLinkButton kind="jourfix" id={task.id} projects={projects} onLinked={() => onLinked(task.id)} />
            )}
            <button onClick={() => onDelete(task)} className="ml-auto flex items-center gap-1 text-slate-400 hover:text-red-600">
              <Trash2 className="w-3.5 h-3.5" /> Löschen
            </button>
          </div>
          <NotesTimeline
            task={task}
            notes={notes}
            profiles={profiles}
            weeks={weeks}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            onAdd={(kind, content) => noteHandlers.onAddNote(task, kind, content)}
            onUpdate={noteHandlers.onUpdateNote}
            onDelete={noteHandlers.onDeleteNote}
          />
        </div>
      )}
    </div>
  );
}

function TopicField({
  value,
  suggestions,
  done,
  onChange,
}: {
  value: string | null;
  suggestions: string[];
  done: boolean;
  onChange: (topic: string | null) => void;
}) {
  const listId = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => {
    if (!editing) setDraft(value ?? "");
  }, [value, editing]);

  function submit() {
    setEditing(false);
    const next = draft.trim() || null;
    if (next !== (value ?? null)) onChange(next);
  }

  if (editing) {
    return (
      <>
        <input
          autoFocus
          list={listId}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={submit}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") { setDraft(value ?? ""); setEditing(false); }
          }}
          placeholder="Thema…"
          className="w-full px-1.5 py-0.5 -my-0.5 border border-slate-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <datalist id={listId}>
          {suggestions.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      title="Thema bearbeiten"
      className={cn(
        "w-full text-left text-sm truncate cursor-text",
        value ? (done ? "text-slate-400" : "font-medium text-slate-700") : "text-slate-300 hover:text-slate-500"
      )}
    >
      {value || "Thema…"}
    </button>
  );
}

function PipelineToggle({ on, disabled, onChange }: { on: boolean; disabled: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      role="checkbox"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      title={disabled ? "Zuerst einen Kunden wählen" : on ? "Wird in der Pipeline bearbeitet – Haken entfernen, um den Punkt dort zu löschen" : "In Pipeline bearbeiten"}
      className={cn(
        "flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full border transition-colors disabled:opacity-40",
        on ? "border-indigo-200 bg-indigo-50 text-indigo-700 font-medium" : "border-slate-200 text-slate-400 hover:text-indigo-700 hover:border-indigo-200"
      )}
    >
      <span
        className={cn(
          "w-3 h-3 rounded-[3px] border flex items-center justify-center",
          on ? "bg-indigo-500 border-indigo-500 text-white" : "border-slate-300"
        )}
      >
        {on && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
      </span>
      Pipeline
    </button>
  );
}

function CustomerPicker({
  task,
  customers,
  onChange,
}: {
  task: JourfixTask;
  customers: { id: string; name: string }[];
  onChange: (customerId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const current = task.customer_id ?? task.customer_item?.customer_id ?? null;
  const name = task.customer?.name ?? task.customer_item?.customers?.name ?? null;
  const filtered = customers.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="flex items-center gap-1 min-w-0">
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            className={cn(
              "flex items-center gap-1.5 min-w-0 text-left text-sm rounded-md",
              name ? (task.done ? "text-slate-400" : "font-medium text-slate-700 hover:text-indigo-700") : "text-amber-600 hover:text-amber-700"
            )}
            title={name ? `Kunde: ${name} – ändern` : "Kunde zuordnen"}
          >
            <Building2 className="w-3.5 h-3.5 shrink-0 text-indigo-400" />
            <span className="truncate">{name ?? "Kunde wählen…"}</span>
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={6}
            className="z-50 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl focus:outline-none"
          >
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Kunde suchen…"
              className="w-full mb-1 px-2 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="max-h-60 overflow-y-auto">
              {filtered.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setOpen(false); setQuery(""); if (c.id !== current) onChange(c.id); }}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-slate-700 hover:bg-slate-50",
                    c.id === current && "bg-indigo-50"
                  )}
                >
                  <span className="truncate flex-1 text-left">{c.name}</span>
                  {c.id === current && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                </button>
              ))}
              {filtered.length === 0 && <p className="px-2 py-3 text-center text-sm text-slate-400">Kein Kunde gefunden</p>}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {current && (
        <Link
          href={`/pipeline?customer=${current}`}
          className="p-0.5 text-slate-300 hover:text-indigo-600 opacity-0 group-hover:opacity-100 shrink-0"
          title="In der Pipeline öffnen"
          aria-label="In der Pipeline öffnen"
        >
          <ExternalLink className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}

/** Spaltenköpfe einer Sektion – gleiche Breiten wie die Zeilen. */
export function ColumnHeader({ lead, main }: { lead: string; main: string }) {
  return (
    <div className="hidden sm:flex items-center gap-2 pl-[60px] pr-[40px] py-1.5 border-b border-slate-100 bg-white text-[11px] font-semibold uppercase tracking-wide text-slate-400">
      <span className={cn(colWidths.lead, "shrink-0 pl-1")}>{lead}</span>
      <span className="flex-1 pl-1">{main}</span>
      <span className={cn(colWidths.assignee, "shrink-0")}>
        <span className="hidden lg:inline">Zuständig</span>
      </span>
      <span className={cn(colWidths.due, "shrink-0")}>Fällig</span>
      <span className={cn(colWidths.priority, "shrink-0 hidden md:block")}>Priorität</span>
      <span className={cn(colWidths.board, "shrink-0 hidden md:block")}>Board</span>
    </div>
  );
}

export function InBoardBadge({ projectId, title }: { projectId: string; title: string }) {
  return (
    <Link
      href={`/projects/${projectId}/board`}
      title={`Im Board: ${title}`}
      className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full bg-cyan-50 text-cyan-700 font-medium hover:bg-cyan-100"
    >
      <CheckCircle2 className="w-3 h-3" /> Im Board
    </Link>
  );
}

export function PriorityPicker({ value, onChange }: { value: Priority; onChange: (p: Priority) => void }) {
  return (
    <div className="flex items-center rounded-md border border-slate-200 overflow-hidden bg-white" role="radiogroup" aria-label="Priorität">
      {(Object.keys(priorityMeta) as Priority[]).map((p) => (
        <button
          key={p}
          type="button"
          role="radio"
          aria-checked={value === p}
          onClick={() => onChange(p)}
          className={cn(
            "flex items-center gap-1 px-2 py-1 text-xs border-l border-slate-200 first:border-l-0",
            value === p ? priorityMeta[p].className + " font-medium" : "text-slate-500 hover:bg-slate-50"
          )}
        >
          <span className={cn("w-1.5 h-1.5 rounded-full", priorityMeta[p].dot)} />
          {priorityMeta[p].label}
        </button>
      ))}
    </div>
  );
}

export function AssigneePicker({
  assignee,
  profiles,
  onChange,
  size = 22,
  showName = false,
}: {
  assignee: Profile | null;
  profiles: Profile[];
  onChange: (id: string | null) => void;
  size?: number;
  showName?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = profiles.filter((p) => (p.full_name || "").toLowerCase().includes(query.toLowerCase()));

  function pick(id: string | null) {
    onChange(id);
    setOpen(false);
    setQuery("");
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-1.5 min-w-0 rounded-full",
            showName ? "pr-2 hover:bg-slate-100" : "p-0.5 hover:ring-2 hover:ring-slate-200"
          )}
          title={assignee ? `Zuständig: ${assignee.full_name}` : "Zuständige Person wählen"}
        >
          {assignee ? (
            <Avatar name={assignee.full_name || "?"} avatarUrl={assignee.avatar_url} size={size} />
          ) : (
            <span
              className="rounded-full border border-dashed border-slate-300 text-slate-400 flex items-center justify-center shrink-0"
              style={{ width: size, height: size }}
            >
              <UserRound className="w-3 h-3" />
            </span>
          )}
          {showName && (
            <span className={cn("hidden lg:block text-xs truncate", assignee ? "text-slate-600" : "text-slate-400")}>
              {assignee ? assignee.full_name : "Niemand"}
            </span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl focus:outline-none"
        >
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suchen…"
            className="w-full mb-1 px-2 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="max-h-60 overflow-y-auto">
            <button
              onClick={() => pick(null)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-slate-500 hover:bg-slate-50"
            >
              <span className="w-5 h-5 rounded-full border border-dashed border-slate-300" />
              Niemand
            </button>
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => pick(p.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-slate-700 hover:bg-slate-50",
                  assignee?.id === p.id && "bg-cyan-50"
                )}
              >
                <Avatar name={p.full_name || "?"} avatarUrl={p.avatar_url} size={20} />
                <span className="truncate flex-1 text-left">{p.full_name || "(kein Name)"}</span>
                {assignee?.id === p.id && <Check className="w-3.5 h-3.5 text-cyan-600" />}
              </button>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
