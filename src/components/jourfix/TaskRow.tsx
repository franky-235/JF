"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as Popover from "@radix-ui/react-popover";
import {
  AlignLeft,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  GripVertical,
  RotateCw,
  Trash2,
  UserRound,
} from "lucide-react";
import type { JourfixTask, Profile } from "@/types";
import Avatar from "@/components/Avatar";
import BoardLinkButton from "@/components/BoardLinkButton";
import { cn } from "@/lib/utils";
import { carryMeta, colWidths, formatDue, isOverdue, priorityMeta, type Priority, type ProjectOption } from "./utils";

export type TaskPatch = Partial<Pick<JourfixTask, "title" | "details" | "assignee_id" | "due_date" | "priority">>;

interface Props {
  task: JourfixTask;
  profiles: Profile[];
  projects: ProjectOption[];
  sortable: boolean;
  onToggleDone: (taskId: string, done: boolean) => void;
  onUpdate: (taskId: string, patch: TaskPatch) => void;
  onDelete: (task: JourfixTask) => void;
  onLinked: (taskId: string) => void;
}

export default function TaskRow({ task, profiles, projects, sortable, onToggleDone, onUpdate, onDelete, onLinked }: Props) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", areaId: task.area_id },
    disabled: !sortable,
  });

  const [expanded, setExpanded] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [details, setDetails] = useState(task.details ?? "");
  const [detailsFocused, setDetailsFocused] = useState(false);

  useEffect(() => {
    if (!editingTitle) setTitle(task.title);
  }, [task.title, editingTitle]);
  useEffect(() => {
    if (!detailsFocused) setDetails(task.details ?? "");
  }, [task.details, detailsFocused]);

  const carry = carryMeta(task.carried_over_count);
  const overdue = isOverdue(task);
  const assignee = profiles.find((p) => p.id === task.assignee_id) ?? null;
  const customerName = task.customer_item?.customers?.name;

  function submitTitle() {
    const next = title.trim();
    setEditingTitle(false);
    if (!next) { setTitle(task.title); return; }
    if (next !== task.title) onUpdate(task.id, { title: next });
  }

  function submitDetails() {
    setDetailsFocused(false);
    const next = details.trim() ? details : "";
    if (next !== (task.details ?? "")) onUpdate(task.id, { details: next || null });
  }

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

        {/* Aufgabe */}
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
              {customerName && (
                <Link
                  href={`/pipeline?customer=${task.customer_item!.customer_id}`}
                  className="flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 hover:bg-indigo-100 max-w-[160px]"
                  title={`Kunde: ${customerName}`}
                >
                  <Building2 className="w-3 h-3 shrink-0" />
                  <span className="truncate">{customerName}</span>
                </Link>
              )}
              {task.details && !expanded && <AlignLeft className="w-3 h-3 text-slate-300" aria-label="Hat Details" />}
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
        <div className="pl-12 pr-4 pb-3 flex flex-col gap-2.5 bg-slate-50/50 border-t border-slate-100">
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            onFocus={() => setDetailsFocused(true)}
            onBlur={submitDetails}
            placeholder="Details, Notizen, Beschlüsse…"
            rows={3}
            className="mt-3 w-full px-2.5 py-2 border border-slate-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ring resize-y"
          />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
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
        </div>
      )}
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
