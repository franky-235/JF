"use client";

import { useMemo, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as Popover from "@radix-ui/react-popover";
import { Building2, ChevronRight, GripVertical, Inbox, Pencil, Plus, Search, Trash2 } from "lucide-react";
import type { JourfixArea, JourfixTask, Profile } from "@/types";
import { cn } from "@/lib/utils";
import TaskRow, { type TaskPatch } from "./TaskRow";
import AddTaskForm, { type NewTaskParams } from "./AddTaskForm";
import type { OpenCustomerItem, ProjectOption } from "./utils";

export const areaDropId = (areaId: string) => `area-drop:${areaId}`;

interface Props {
  area: JourfixArea;
  tasks: JourfixTask[];
  totalCount: number;
  openCount: number;
  profiles: Profile[];
  projects: ProjectOption[];
  customers: { id: string; name: string }[];
  /** Offene Kundenpunkte, die in dieser Woche noch nicht im Jourfix stehen */
  availableCustomerItems: OpenCustomerItem[];
  isAdmin: boolean;
  dndEnabled: boolean;
  onRename: (name: string) => void;
  onDeleteArea: () => void;
  onToggleDone: (taskId: string, done: boolean) => void;
  onUpdateTask: (taskId: string, patch: TaskPatch) => void;
  onDeleteTask: (task: JourfixTask) => void;
  onAddTask: (params: NewTaskParams) => void;
  onAddCustomerItem: (itemId: string) => void;
  onLinked: (taskId: string) => void;
}

/** Eine Kategorie als Abschnitt der Jourfix-Liste. */
export default function AreaCard({
  area,
  tasks,
  totalCount,
  openCount,
  profiles,
  projects,
  customers,
  availableCustomerItems,
  isAdmin,
  dndEnabled,
  onRename,
  onDeleteArea,
  onToggleDone,
  onUpdateTask,
  onDeleteTask,
  onAddTask,
  onAddCustomerItem,
  onLinked,
}: Props) {
  const isCustomers = area.kind === "customers";
  const [collapsed, setCollapsed] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(area.name);
  const [showAddTask, setShowAddTask] = useState(false);

  const sortable = useSortable({
    id: area.id,
    data: { type: "area" },
    disabled: !isAdmin || !dndEnabled,
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: areaDropId(area.id),
    data: { type: "area-drop", areaId: area.id },
    disabled: !dndEnabled || collapsed,
  });

  function submitRename() {
    if (name.trim() && name.trim() !== area.name) onRename(name.trim());
    else setName(area.name);
    setEditingName(false);
  }

  const doneCount = totalCount - openCount;
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <section
      ref={sortable.setNodeRef}
      style={{ transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition }}
      className={cn(
        "bg-white border border-slate-200 rounded-xl overflow-hidden",
        sortable.isDragging && "opacity-50 shadow-xl relative z-10"
      )}
    >
      <header className="group/area flex items-center gap-2 pl-2 pr-3 py-2.5 bg-slate-50 border-b border-slate-200">
        {isAdmin && dndEnabled ? (
          <button
            ref={sortable.setActivatorNodeRef}
            {...sortable.attributes}
            {...sortable.listeners}
            className="p-0.5 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing opacity-0 group-hover/area:opacity-100 focus-visible:opacity-100 touch-none"
            aria-label="Kategorie verschieben"
          >
            <GripVertical className="w-4 h-4" />
          </button>
        ) : (
          <span className="w-5" />
        )}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="p-0.5 text-slate-400 hover:text-slate-700"
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Kategorie aufklappen" : "Kategorie zuklappen"}
        >
          <ChevronRight className={cn("w-4 h-4 transition-transform", !collapsed && "rotate-90")} />
        </button>
        {isCustomers && <Building2 className="w-4 h-4 text-indigo-500 shrink-0" />}

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
            className="min-w-0 w-64 px-2 py-0.5 border border-slate-200 rounded-md text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-ring"
          />
        ) : (
          <h3 className="min-w-0 font-semibold text-sm text-slate-800 truncate">{area.name}</h3>
        )}

        <span className="text-xs tabular-nums text-slate-500 shrink-0">
          {openCount} offen · {totalCount} gesamt
        </span>
        <div className="hidden sm:block w-20 h-1 rounded-full bg-slate-200 overflow-hidden shrink-0" title={`${pct}% erledigt`}>
          <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${pct}%` }} />
        </div>

        <div className="ml-auto flex items-center gap-1">
          {isAdmin && !editingName && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover/area:opacity-100 focus-within:opacity-100 transition-opacity">
              <button
                onClick={() => setEditingName(true)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-white"
                aria-label="Kategorie umbenennen"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              {!isCustomers && (
                <button
                  onClick={onDeleteArea}
                  className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50"
                  aria-label="Kategorie löschen"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
          {isCustomers && (
            <CustomerItemPicker items={availableCustomerItems} onPick={(id) => { setCollapsed(false); onAddCustomerItem(id); }} />
          )}
          <button
            onClick={() => { setCollapsed(false); setShowAddTask(true); }}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-slate-600 hover:bg-white hover:text-cyan-700"
          >
            <Plus className="w-3.5 h-3.5" /> Aufgabe
          </button>
        </div>
      </header>

      {!collapsed && (
        <div ref={setDropRef} className={cn("transition-colors", isOver && "bg-cyan-50/60")}>
          <div className="divide-y divide-slate-100">
            <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              {tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  profiles={profiles}
                  projects={projects}
                  sortable={dndEnabled}
                  onToggleDone={onToggleDone}
                  onUpdate={onUpdateTask}
                  onDelete={onDeleteTask}
                  onLinked={onLinked}
                />
              ))}
            </SortableContext>
          </div>

          {tasks.length === 0 && !showAddTask && (
            <p className="text-xs text-slate-400 py-4 text-center">
              {totalCount > 0 ? "Keine Aufgaben für diesen Filter" : isCustomers ? "Noch keine Kundenpunkte in dieser Woche" : "Noch keine Aufgaben"}
            </p>
          )}

          {showAddTask && (
            <div className="p-3 border-t border-slate-100">
              <AddTaskForm
                profiles={profiles}
                projects={projects}
                customers={isCustomers ? customers : undefined}
                onSubmit={onAddTask}
                onCancel={() => setShowAddTask(false)}
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function CustomerItemPicker({ items, onPick }: { items: OpenCustomerItem[]; onPick: (itemId: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<string, { name: string; items: OpenCustomerItem[] }>();
    for (const item of items) {
      const customerName = item.customers?.name ?? "Unbekannter Kunde";
      if (q && !item.title.toLowerCase().includes(q) && !customerName.toLowerCase().includes(q)) continue;
      const entry = map.get(item.customer_id) ?? { name: customerName, items: [] };
      entry.items.push(item);
      map.set(item.customer_id, entry);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [items, query]);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-indigo-700 hover:bg-white">
          <Inbox className="w-3.5 h-3.5" /> Kundenpunkte
          {items.length > 0 && (
            <span className="ml-0.5 px-1.5 rounded-full bg-indigo-100 text-[10px] font-semibold tabular-nums">{items.length}</span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 w-80 rounded-xl border border-slate-200 bg-white shadow-xl focus:outline-none flex flex-col max-h-[420px]"
        >
          <div className="p-2 border-b border-slate-100">
            <p className="px-1 pb-2 text-xs font-semibold text-slate-700">Offene Punkte aus der Pipeline übernehmen</p>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Kunde oder Punkt suchen…"
                className="w-full pl-8 pr-2 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5">
            {grouped.map((g) => (
              <div key={g.name} className="mb-1.5">
                <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{g.name}</p>
                {g.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onPick(item.id)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-slate-700 hover:bg-indigo-50 text-left"
                  >
                    <Plus className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span className="truncate">{item.title}</span>
                  </button>
                ))}
              </div>
            ))}
            {grouped.length === 0 && (
              <p className="px-2 py-6 text-center text-sm text-slate-400">
                {items.length === 0 ? "Alle offenen Kundenpunkte stehen bereits im Jour Fixe." : "Keine Treffer"}
              </p>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
