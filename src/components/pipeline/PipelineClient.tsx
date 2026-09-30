"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CalendarClock, Check, Columns3, List, Loader2, Plus, Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Customer, CustomerItem, PipelineStage, Profile } from "@/types";
import { cn } from "@/lib/utils";
import { pipelineStages, stageMeta } from "@/lib/pipeline";
import { Toaster, toast } from "@/components/ui/toast";
import { ConfirmHost, confirmDialog } from "@/components/ui/confirm-dialog";
import type { BoardProjectOption } from "@/components/BoardLinkButton";
import { formatDue, isOverdue } from "@/components/jourfix/utils";
import CustomerPanel from "./CustomerPanel";
import { CUSTOMER_ITEM_SELECT } from "./select";

export type PipelineItem = CustomerItem & {
  jourfix_tasks: { id: string; week_id: string }[];
  linked_task: { id: string; title: string; project_id: string } | null;
};
export type PipelineCustomer = Customer & { customer_items: PipelineItem[] };

type ItemPatch = Partial<Pick<PipelineItem, "title" | "done" | "assignee_id" | "due_date">>;

interface Props {
  customers: PipelineCustomer[];
  profiles: Profile[];
  projects: BoardProjectOption[];
  currentWeekId: string | null;
  initialCustomerId: string | null;
  initialView: "kanban" | "list";
}

export default function PipelineClient({
  customers: initialCustomers,
  profiles,
  projects,
  currentWeekId,
  initialCustomerId,
  initialView,
}: Props) {
  const router = useRouter();
  const [customers, setCustomers] = useState(initialCustomers);
  const [view, setView] = useState<"kanban" | "list">(initialView);
  const [query, setQuery] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [panelId, setPanelId] = useState<string | null>(initialCustomerId);
  const [dragId, setDragId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => setCustomers(initialCustomers), [initialCustomers]);

  // ---------- Realtime ----------
  const localChangeUntil = useRef(0);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markLocalChange = useCallback(() => {
    localChangeUntil.current = Date.now() + 1500;
  }, []);
  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    const delay = Math.max(300, localChangeUntil.current - Date.now());
    refreshTimer.current = setTimeout(() => router.refresh(), delay);
  }, [router]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("pipeline")
      .on("postgres_changes", { event: "*", schema: "public", table: "customers" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "customer_items" }, scheduleRefresh)
      .subscribe();
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      supabase.removeChannel(channel);
    };
  }, [scheduleRefresh]);

  function fail(message: string, error: { message: string }) {
    toast.error(`${message}: ${error.message}`);
    router.refresh();
  }

  function patchCustomer(id: string, fn: (c: PipelineCustomer) => PipelineCustomer) {
    setCustomers((prev) => prev.map((c) => (c.id === id ? fn(c) : c)));
  }

  function updateUrl(customerId: string | null, nextView = view) {
    const params = new URLSearchParams();
    if (customerId) params.set("customer", customerId);
    if (nextView === "list") params.set("view", "list");
    const qs = params.toString();
    window.history.replaceState(null, "", `/pipeline${qs ? `?${qs}` : ""}`);
  }

  function openPanel(id: string | null) {
    setPanelId(id);
    updateUrl(id);
  }

  // ---------- Kunden ----------
  async function handleStageChange(customerId: string, stage: PipelineStage) {
    const supabase = createClient();
    markLocalChange();
    const now = new Date().toISOString();
    patchCustomer(customerId, (c) => ({ ...c, pipeline_stage: stage, stage_changed_at: now }));
    const { error } = await supabase.from("customers").update({ pipeline_stage: stage, stage_changed_at: now }).eq("id", customerId);
    if (error) fail("Phase konnte nicht geändert werden", error);
  }

  async function handleCreateCustomer(name: string, company: string, stage: PipelineStage) {
    const supabase = createClient();
    markLocalChange();
    const { data, error } = await supabase
      .from("customers")
      .insert({ name, company: company || null, pipeline_stage: stage })
      .select()
      .single();
    if (error) return fail("Kunde konnte nicht angelegt werden", error);
    setCustomers((prev) => [...prev, { ...data, customer_items: [] }].sort((a, b) => a.name.localeCompare(b.name)));
    setCreating(false);
    toast.success(`${name} angelegt`);
    openPanel(data.id);
  }

  // ---------- Kundenpunkte ----------
  async function reloadItem(itemId: string) {
    const supabase = createClient();
    const { data } = await supabase.from("customer_items").select(CUSTOMER_ITEM_SELECT).eq("id", itemId).single();
    if (!data) return;
    const item = data as unknown as PipelineItem;
    patchCustomer(item.customer_id, (c) => ({
      ...c,
      customer_items: c.customer_items.some((i) => i.id === item.id)
        ? c.customer_items.map((i) => (i.id === item.id ? item : i))
        : [...c.customer_items, item],
    }));
  }

  async function handleAddItem(customerId: string, title: string, assigneeId: string | null, dueDate: string | null) {
    const supabase = createClient();
    markLocalChange();
    const customer = customers.find((c) => c.id === customerId);
    const position = (customer?.customer_items ?? []).reduce((m, i) => Math.max(m, i.position + 1), 0);
    const { data, error } = await supabase
      .from("customer_items")
      .insert({ customer_id: customerId, title, assignee_id: assigneeId, due_date: dueDate, position })
      .select("id")
      .single();
    if (error) return fail("Punkt konnte nicht angelegt werden", error);
    await reloadItem(data.id);
  }

  async function handleUpdateItem(customerId: string, itemId: string, patch: ItemPatch) {
    const supabase = createClient();
    markLocalChange();
    patchCustomer(customerId, (c) => ({
      ...c,
      customer_items: c.customer_items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)),
    }));
    const { error } = await supabase.from("customer_items").update(patch).eq("id", itemId);
    if (error) fail("Änderung konnte nicht gespeichert werden", error);
  }

  async function handleDeleteItem(customerId: string, item: PipelineItem) {
    const ok = await confirmDialog({
      title: `„${item.title}“ löschen?`,
      description: item.jourfix_tasks.length > 0 ? "Der Punkt bleibt im Jour Fixe als normale Aufgabe stehen." : undefined,
      confirmLabel: "Löschen",
      destructive: true,
    });
    if (!ok) return;
    const supabase = createClient();
    markLocalChange();
    patchCustomer(customerId, (c) => ({ ...c, customer_items: c.customer_items.filter((i) => i.id !== item.id) }));
    const { error } = await supabase.from("customer_items").delete().eq("id", item.id);
    if (error) fail("Punkt konnte nicht gelöscht werden", error);
  }

  async function handleAddToJourfix(itemId: string) {
    const supabase = createClient();
    markLocalChange();
    const { error } = await supabase.rpc("jourfix_add_customer_item", { p_item_id: itemId, p_week_id: currentWeekId });
    if (error) return fail("Übernahme in den Jour Fixe fehlgeschlagen", error);
    toast.success("In den Jour Fixe der aktuellen Woche übernommen");
    await reloadItem(itemId);
    if (!currentWeekId) router.refresh();
  }

  // ---------- Filter ----------
  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      customers.filter(
        (c) =>
          (!q || [c.name, c.company, c.email].some((v) => v?.toLowerCase().includes(q))) &&
          (!onlyOpen || c.customer_items.some((i) => !i.done))
      ),
    [customers, q, onlyOpen]
  );
  const byStage = useMemo(() => {
    const map = new Map<PipelineStage, PipelineCustomer[]>(pipelineStages.map((s) => [s.id, []]));
    for (const c of filtered) map.get(c.pipeline_stage)?.push(c);
    return map;
  }, [filtered]);
  const totalOpenItems = customers.reduce((n, c) => n + c.customer_items.filter((i) => !i.done).length, 0);

  // ---------- Drag & Drop ----------
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  function handleDragStart({ active }: DragStartEvent) {
    setDragId(active.id as string);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setDragId(null);
    if (!over) return;
    const stage = over.id as PipelineStage;
    const customer = customers.find((c) => c.id === active.id);
    if (customer && customer.pipeline_stage !== stage && stageMeta[stage]) handleStageChange(customer.id, stage);
  }

  const dragCustomer = dragId ? customers.find((c) => c.id === dragId) ?? null : null;
  const panelCustomer = panelId ? customers.find((c) => c.id === panelId) ?? null : null;

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-4 border-b border-slate-200 bg-white space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Pipeline</h1>
            <p className="text-sm text-slate-500">
              {customers.length} Kunden · {totalOpenItems} offene Punkte
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-slate-200 p-0.5 bg-white" role="radiogroup" aria-label="Ansicht">
              {([
                ["kanban", Columns3, "Phasen"],
                ["list", List, "Liste"],
              ] as const).map(([id, Icon, label]) => (
                <button
                  key={id}
                  role="radio"
                  aria-checked={view === id}
                  onClick={() => { setView(id); updateUrl(panelId, id); }}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs",
                    view === id ? "bg-slate-100 text-slate-800 font-semibold" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90"
            >
              <Plus className="w-4 h-4" /> Neuer Kunde
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Kunden suchen…"
              className="pl-8 pr-3 py-1.5 w-60 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            onClick={() => setOnlyOpen((v) => !v)}
            aria-pressed={onlyOpen}
            className={cn(
              "px-2.5 py-1.5 rounded-lg border text-xs",
              onlyOpen ? "border-cyan-300 bg-cyan-50 text-cyan-800 font-medium" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            )}
          >
            Nur mit offenen Punkten
          </button>
        </div>
      </div>

      {view === "kanban" ? (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setDragId(null)}>
          <div className="flex-1 overflow-x-auto">
            <div className="flex gap-3 p-6 min-h-full">
              {pipelineStages.map((s) => (
                <StageColumn key={s.id} stage={s} customers={byStage.get(s.id) ?? []} onOpen={openPanel} />
              ))}
            </div>
          </div>
          <DragOverlay dropAnimation={null}>
            {dragCustomer && <CustomerCard customer={dragCustomer} overlay />}
          </DragOverlay>
        </DndContext>
      ) : (
        <div className="flex-1 overflow-auto p-6">
          <CustomerTable customers={filtered} onOpen={openPanel} onStageChange={handleStageChange} currentWeekId={currentWeekId} />
        </div>
      )}

      {panelCustomer && (
        <CustomerPanel
          customer={panelCustomer}
          profiles={profiles}
          projects={projects}
          currentWeekId={currentWeekId}
          onClose={() => openPanel(null)}
          onStageChange={(stage) => handleStageChange(panelCustomer.id, stage)}
          onAddItem={(title, assigneeId, dueDate) => handleAddItem(panelCustomer.id, title, assigneeId, dueDate)}
          onUpdateItem={(itemId, patch) => handleUpdateItem(panelCustomer.id, itemId, patch)}
          onDeleteItem={(item) => handleDeleteItem(panelCustomer.id, item)}
          onAddToJourfix={handleAddToJourfix}
          onReloadItem={reloadItem}
        />
      )}

      {creating && <NewCustomerDialog onCreate={handleCreateCustomer} onCancel={() => setCreating(false)} />}

      <ConfirmHost />
      <Toaster />
    </div>
  );
}

function StageColumn({
  stage,
  customers,
  onOpen,
}: {
  stage: (typeof pipelineStages)[number];
  customers: PipelineCustomer[];
  onOpen: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const openItems = customers.reduce((n, c) => n + c.customer_items.filter((i) => !i.done).length, 0);

  return (
    <div className="w-72 shrink-0 flex flex-col">
      <div className="flex items-center gap-2 px-1 pb-2">
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
        <span className="text-sm font-semibold text-slate-700">{stage.label}</span>
        <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full tabular-nums">{customers.length}</span>
        {openItems > 0 && <span className="ml-auto text-[11px] text-slate-400 tabular-nums">{openItems} offen</span>}
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 rounded-xl p-2 space-y-2 min-h-[140px] transition-colors border-2",
          isOver ? "border-dashed border-cyan-300 bg-cyan-50/50" : "border-transparent bg-slate-100/60"
        )}
      >
        {customers.map((c) => (
          <DraggableCustomer key={c.id} customer={c} onOpen={() => onOpen(c.id)} />
        ))}
        {customers.length === 0 && <p className="text-center text-xs text-slate-400 py-6">Keine Kunden</p>}
      </div>
    </div>
  );
}

function DraggableCustomer({ customer, onOpen }: { customer: PipelineCustomer; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: customer.id });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={cn("touch-none", isDragging && "opacity-30")}>
      <CustomerCard customer={customer} onOpen={onOpen} />
    </div>
  );
}

function CustomerCard({ customer, onOpen, overlay }: { customer: PipelineCustomer; onOpen?: () => void; overlay?: boolean }) {
  const open = customer.customer_items.filter((i) => !i.done);
  const overdue = open.filter((i) => isOverdue(i)).length;
  return (
    <div
      onClick={onOpen}
      className={cn(
        "bg-white border border-slate-200 rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow select-none",
        overlay && "shadow-xl rotate-1"
      )}
    >
      <div className="flex items-start gap-2.5">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center font-semibold text-sm shrink-0"
          style={{ backgroundColor: "#00ffff20", color: "#007777" }}
        >
          {(customer.company || customer.name || "?").charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800 truncate">{customer.name}</p>
          {customer.company && <p className="text-xs text-slate-400 truncate">{customer.company}</p>}
        </div>
      </div>
      {open.length > 0 && (
        <ul className="mt-2.5 space-y-1">
          {open.slice(0, 3).map((i) => (
            <li key={i.id} className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
              <span className="truncate flex-1">{i.title}</span>
              {i.jourfix_tasks.length > 0 && <CalendarClock className="w-3 h-3 text-indigo-400 shrink-0" aria-label="Im Jour Fixe" />}
              {i.linked_task && <Check className="w-3 h-3 text-cyan-500 shrink-0" aria-label="Im Board" />}
            </li>
          ))}
          {open.length > 3 && <li className="text-[11px] text-slate-400 pl-3">+ {open.length - 3} weitere</li>}
        </ul>
      )}
      <div className="mt-2.5 flex items-center gap-1.5 text-[11px]">
        <span className={cn("px-1.5 py-0.5 rounded-full font-medium", open.length > 0 ? "bg-amber-50 text-amber-700" : "bg-slate-50 text-slate-400")}>
          {open.length} offen
        </span>
        {overdue > 0 && <span className="px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">{overdue} überfällig</span>}
      </div>
    </div>
  );
}

function CustomerTable({
  customers,
  onOpen,
  onStageChange,
  currentWeekId,
}: {
  customers: PipelineCustomer[];
  onOpen: (id: string) => void;
  onStageChange: (id: string, stage: PipelineStage) => void;
  currentWeekId: string | null;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-4 py-2.5">Kunde</th>
            <th className="px-4 py-2.5 w-44">Phase</th>
            <th className="px-4 py-2.5 w-28">Offen</th>
            <th className="px-4 py-2.5 w-32 hidden md:table-cell">Nächste Fälligkeit</th>
            <th className="px-4 py-2.5 w-32 hidden lg:table-cell">Im Jour Fixe</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {customers.map((c) => {
            const open = c.customer_items.filter((i) => !i.done);
            const nextDue = open.map((i) => i.due_date).filter(Boolean).sort()[0] as string | undefined;
            const inJf = open.filter((i) => currentWeekId && i.jourfix_tasks.some((j) => j.week_id === currentWeekId)).length;
            return (
              <tr key={c.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => onOpen(c.id)}>
                <td className="px-4 py-2.5">
                  <div className="font-medium text-slate-800">{c.name}</div>
                  {c.company && <div className="text-xs text-slate-400">{c.company}</div>}
                </td>
                <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <select
                    value={c.pipeline_stage}
                    onChange={(e) => onStageChange(c.id, e.target.value as PipelineStage)}
                    className={cn("px-2 py-1 rounded-full text-xs font-medium border-0 focus:outline-none focus:ring-2 focus:ring-ring", stageMeta[c.pipeline_stage].badge)}
                    aria-label="Phase"
                  >
                    {pipelineStages.map((s) => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2.5 tabular-nums text-slate-600">{open.length}</td>
                <td className="px-4 py-2.5 hidden md:table-cell">
                  {nextDue ? (
                    <span className={cn("text-xs", nextDue < new Date().toISOString().slice(0, 10) ? "text-red-600 font-medium" : "text-slate-500")}>
                      {formatDue(nextDue)}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-300">–</span>
                  )}
                </td>
                <td className="px-4 py-2.5 hidden lg:table-cell text-xs text-slate-500 tabular-nums">
                  {inJf > 0 ? `${inJf} von ${open.length}` : "–"}
                </td>
              </tr>
            );
          })}
          {customers.length === 0 && (
            <tr>
              <td colSpan={5} className="py-12 text-center text-sm text-slate-400">Keine Kunden gefunden</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function NewCustomerDialog({
  onCreate,
  onCancel,
}: {
  onCreate: (name: string, company: string, stage: PipelineStage) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [stage, setStage] = useState<PipelineStage>("lead");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setSaving(true);
    await onCreate(name.trim(), company.trim(), stage);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="new-customer-title">
        <div className="flex items-center justify-between mb-4">
          <h2 id="new-customer-title" className="text-lg font-semibold text-slate-800">Neuer Kunde</h2>
          <button onClick={onCancel} className="p-1 rounded-md text-slate-400 hover:text-slate-700" aria-label="Schließen">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Name *"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Firma"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value as PipelineStage)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Phase"
          >
            {pipelineStages.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          <p className="text-xs text-slate-400">E-Mail, Telefon und Notizen pflegst du wie gewohnt unter „Kunden“.</p>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onCancel} className="flex-1 px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
            Abbrechen
          </button>
          <button
            onClick={submit}
            disabled={saving || !name.trim()}
            className="flex-1 px-4 py-2 text-sm rounded-lg font-semibold flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Anlegen
          </button>
        </div>
      </div>
    </div>
  );
}
