"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import {
  AlertTriangle,
  CalendarPlus,
  CheckCircle2,
  CircleDot,
  History,
  Loader2,
  Pencil,
  Plus,
  RotateCw,
  Search,
  UserRound,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { JourfixArea, JourfixNote, JourfixTask, JourfixWeek, Profile } from "@/types";
import Avatar from "@/components/Avatar";
import { Toaster, toast } from "@/components/ui/toast";
import { ConfirmHost, confirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import WeekTabs from "./WeekTabs";
import AreaCard from "./AreaCard";
import DoneSection from "./DoneSection";
import ParticipantsModal from "./ParticipantsModal";
import type { NoteHandlers, TaskPatch } from "./TaskRow";
import type { NewTaskParams } from "./AddTaskForm";
import {
  JOURFIX_TASK_SELECT,
  isOverdue,
  shiftWeek,
  sortByPosition,
  weekLabel,
  type OpenCustomerItem,
  type ProjectOption,
} from "./utils";

export type { ProjectOption } from "./utils";

interface Props {
  isAdmin: boolean;
  currentUserId: string | null;
  currentWeekStart: string;
  weeks: JourfixWeek[];
  selectedWeekStart: string;
  selectedWeek: JourfixWeek | null;
  areas: JourfixArea[];
  tasks: JourfixTask[];
  profiles: Profile[];
  projects: ProjectOption[];
  customers: { id: string; name: string }[];
  openCustomerItems: OpenCustomerItem[];
  notes: JourfixNote[];
}

/** Ordnet `activeId` im Bereich `areaId` vor `beforeId` (oder am Ende) ein und nummeriert neu. */
function placeTask(list: JourfixTask[], activeId: string, areaId: string, beforeId: string | null) {
  const active = list.find((t) => t.id === activeId);
  if (!active) return list;
  const target = sortByPosition(list.filter((t) => t.area_id === areaId && t.id !== activeId && !t.done));
  let idx = beforeId ? target.findIndex((t) => t.id === beforeId) : -1;
  if (idx < 0) idx = target.length;
  target.splice(idx, 0, { ...active, area_id: areaId });
  const pos = new Map(target.map((t, i) => [t.id, i]));
  return list.map((t) => (pos.has(t.id) ? { ...t, area_id: areaId, position: pos.get(t.id)! } : t));
}

export default function JourfixClient({
  isAdmin,
  currentUserId,
  currentWeekStart,
  weeks,
  selectedWeekStart,
  selectedWeek,
  areas: initialAreas,
  tasks: initialTasks,
  profiles,
  projects,
  customers,
  openCustomerItems,
  notes: initialNotes,
}: Props) {
  const router = useRouter();
  const [areas, setAreas] = useState(initialAreas);
  const [tasks, setTasks] = useState(initialTasks);
  const [notes, setNotes] = useState(initialNotes);
  const [creatingWeek, setCreatingWeek] = useState(false);
  const [newWeekStart, setNewWeekStart] = useState<string | null>(null);
  const [editingParticipants, setEditingParticipants] = useState(false);
  const [carrying, setCarrying] = useState(false);
  const [onlyMine, setOnlyMine] = useState(false);
  const [query, setQuery] = useState("");
  const [activeDragTask, setActiveDragTask] = useState<JourfixTask | null>(null);

  // Server-Daten nach router.refresh() übernehmen (Realtime, andere Nutzer)
  useEffect(() => setAreas(initialAreas), [initialAreas]);
  useEffect(() => setTasks(initialTasks), [initialTasks]);
  useEffect(() => setNotes(initialNotes), [initialNotes]);

  // ---------- Realtime ----------
  const localChangeUntil = useRef(0);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markLocalChange = useCallback(() => {
    localChangeUntil.current = Date.now() + 1500;
  }, []);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    // Eigene Änderungen kommen als Echo zurück: erst nach dem Schreibfenster neu laden
    const delay = Math.max(300, localChangeUntil.current - Date.now());
    refreshTimer.current = setTimeout(() => router.refresh(), delay);
  }, [router]);

  useEffect(() => {
    if (!selectedWeek) return;
    const supabase = createClient();
    const filter = `week_id=eq.${selectedWeek.id}`;
    const channel = supabase
      .channel(`jourfix-${selectedWeek.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "jourfix_tasks", filter }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "jourfix_week_participants", filter }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "jourfix_areas" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "jourfix_notes" }, scheduleRefresh)
      .subscribe();
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      supabase.removeChannel(channel);
    };
  }, [selectedWeek, scheduleRefresh]);

  function fail(message: string, error: { message: string }) {
    toast.error(`${message}: ${error.message}`);
    router.refresh();
  }

  // ---------- Bereiche ----------
  async function handleAddArea(name: string) {
    const supabase = createClient();
    markLocalChange();
    const { data, error } = await supabase
      .from("jourfix_areas")
      .insert({ name, position: areas.length, created_by: currentUserId })
      .select()
      .single();
    if (error) return fail("Kategorie konnte nicht angelegt werden", error);
    if (data) setAreas((prev) => [...prev, data]);
  }

  async function handleRenameArea(areaId: string, name: string) {
    const supabase = createClient();
    markLocalChange();
    setAreas((prev) => prev.map((a) => (a.id === areaId ? { ...a, name } : a)));
    const { error } = await supabase.from("jourfix_areas").update({ name }).eq("id", areaId);
    if (error) fail("Umbenennen fehlgeschlagen", error);
  }

  async function handleDeleteArea(area: JourfixArea) {
    const ok = await confirmDialog({
      title: `Kategorie „${area.name}“ löschen?`,
      description: "Alle Aufgaben dieser Kategorie werden in allen Wochen entfernt. Das kann nicht rückgängig gemacht werden.",
      confirmLabel: "Kategorie löschen",
      destructive: true,
    });
    if (!ok) return;
    const supabase = createClient();
    markLocalChange();
    setAreas((prev) => prev.filter((a) => a.id !== area.id));
    setTasks((prev) => prev.filter((t) => t.area_id !== area.id));
    const { error } = await supabase.from("jourfix_areas").delete().eq("id", area.id);
    if (error) return fail("Kategorie konnte nicht gelöscht werden", error);
    toast.success(`Kategorie „${area.name}“ gelöscht`);
  }

  // ---------- Aufgaben ----------
  async function handleToggleDone(taskId: string, done: boolean) {
    const supabase = createClient();
    markLocalChange();
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, done } : t)));
    const { error } = await supabase.from("jourfix_tasks").update({ done }).eq("id", taskId);
    if (error) fail("Aufgabe konnte nicht aktualisiert werden", error);
  }

  async function handleUpdateTask(taskId: string, patch: TaskPatch) {
    const supabase = createClient();
    markLocalChange();
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t)));
    const { error } = await supabase.from("jourfix_tasks").update(patch).eq("id", taskId);
    if (error) fail("Änderung konnte nicht gespeichert werden", error);
  }

  async function handleDeleteTask(task: JourfixTask) {
    const ok = await confirmDialog({
      title: `Aufgabe „${task.title}“ löschen?`,
      description: task.linked_task ? "Die verknüpfte Board-Aufgabe bleibt erhalten." : undefined,
      confirmLabel: "Löschen",
      destructive: true,
    });
    if (!ok) return;
    const supabase = createClient();
    markLocalChange();
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    const { error } = await supabase.from("jourfix_tasks").delete().eq("id", task.id);
    if (error) fail("Aufgabe konnte nicht gelöscht werden", error);
  }

  /** Lädt eine Aufgabe inkl. Verknüpfungen neu und übernimmt sie in den State. */
  async function reloadTask(taskId: string) {
    const supabase = createClient();
    const { data } = await supabase.from("jourfix_tasks").select(JOURFIX_TASK_SELECT).eq("id", taskId).single();
    if (!data) return;
    setTasks((prev) => (prev.some((t) => t.id === taskId) ? prev.map((t) => (t.id === taskId ? data : t)) : [...prev, data]));
  }

  async function handleAddTask(areaId: string, params: NewTaskParams) {
    if (!selectedWeek) return;
    const supabase = createClient();
    markLocalChange();

    let taskId: string;
    if (params.customerId) {
      // Kategorie „Kunden“: erst Kundenpunkt anlegen, dann in diese Woche übernehmen
      const { data: item, error: itemError } = await supabase
        .from("customer_items")
        .insert({
          customer_id: params.customerId,
          title: params.title,
          assignee_id: params.assigneeId,
          due_date: params.dueDate,
          created_by: currentUserId,
        })
        .select("id")
        .single();
      if (itemError) return fail("Kundenpunkt konnte nicht angelegt werden", itemError);
      const { data: id, error } = await supabase.rpc("jourfix_add_customer_item", { p_item_id: item.id, p_week_id: selectedWeek.id });
      if (error) return fail("Kundenpunkt konnte nicht übernommen werden", error);
      taskId = id as string;
      if (params.priority !== "medium") await supabase.from("jourfix_tasks").update({ priority: params.priority }).eq("id", taskId);
    } else {
      const position = tasks.filter((t) => t.area_id === areaId).reduce((max, t) => Math.max(max, t.position + 1), 0);
      const { data, error } = await supabase
        .from("jourfix_tasks")
        .insert({
          week_id: selectedWeek.id,
          area_id: areaId,
          topic: params.topic,
          title: params.title,
          assignee_id: params.assigneeId,
          due_date: params.dueDate,
          priority: params.priority,
          position,
          created_by: currentUserId,
        })
        .select("id")
        .single();
      if (error) return fail("Aufgabe konnte nicht angelegt werden", error);
      taskId = data.id;
    }

    if (params.linkToBoard && params.columnId) {
      const { error } = await supabase.rpc("link_to_board", { p_kind: "jourfix", p_id: taskId, p_column_id: params.columnId });
      if (error) toast.error(`Übernahme ins Board fehlgeschlagen: ${error.message}`);
    }
    await reloadTask(taskId);
    if (params.customerId) router.refresh();
  }

  async function handleAddCustomerItem(itemId: string) {
    if (!selectedWeek) return;
    const supabase = createClient();
    markLocalChange();
    const { data, error } = await supabase.rpc("jourfix_add_customer_item", { p_item_id: itemId, p_week_id: selectedWeek.id });
    if (error) return fail("Kundenpunkt konnte nicht übernommen werden", error);
    await reloadTask(data as string);
    router.refresh();
  }

  async function handleLinked(taskId: string) {
    markLocalChange();
    await reloadTask(taskId);
  }

  // ---------- Notizen-Verlauf ----------
  const notesByThread = useMemo(() => {
    const map = new Map<string, JourfixNote[]>();
    for (const n of [...notes].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
      const list = map.get(n.thread_id) ?? [];
      list.push(n);
      map.set(n.thread_id, list);
    }
    return map;
  }, [notes]);

  const noteHandlers: NoteHandlers = {
    async onAddNote(task, kind, content) {
      const supabase = createClient();
      markLocalChange();
      const { data, error } = await supabase
        .from("jourfix_notes")
        .insert({ thread_id: task.thread_id, week_id: task.week_id, kind, content, author_id: currentUserId })
        .select()
        .single();
      if (error) { toast.error(`Eintrag konnte nicht gespeichert werden: ${error.message}`); return false; }
      setNotes((prev) => [...prev, data]);
      return true;
    },
    async onUpdateNote(noteId, content) {
      const supabase = createClient();
      markLocalChange();
      const now = new Date().toISOString();
      setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, content, updated_at: now } : n)));
      const { error } = await supabase.from("jourfix_notes").update({ content }).eq("id", noteId);
      if (error) fail("Eintrag konnte nicht geändert werden", error);
    },
    async onDeleteNote(note) {
      const ok = await confirmDialog({
        title: "Eintrag löschen?",
        description: "Der Eintrag verschwindet aus dem Verlauf aller Wochen.",
        confirmLabel: "Löschen",
        destructive: true,
      });
      if (!ok) return;
      const supabase = createClient();
      markLocalChange();
      setNotes((prev) => prev.filter((n) => n.id !== note.id));
      const { error } = await supabase.from("jourfix_notes").delete().eq("id", note.id);
      if (error) fail("Eintrag konnte nicht gelöscht werden", error);
    },
  };

  // ---------- Wochen ----------
  const sortedWeeks = useMemo(() => [...weeks].sort((a, b) => b.week_start.localeCompare(a.week_start)), [weeks]);
  const previousWeek = sortedWeeks.find((w) => w.week_start < selectedWeekStart) ?? null;

  function openNewWeekModal(explicitWeekStart?: string) {
    const latest = sortedWeeks[0]?.week_start ?? shiftWeek(currentWeekStart, -1);
    setNewWeekStart(explicitWeekStart ?? shiftWeek(latest, 1));
  }

  async function setWeekParticipants(weekId: string, participantIds: string[]) {
    const supabase = createClient();
    const { error } = await supabase.rpc("jourfix_set_participants", { p_week_id: weekId, p_user_ids: participantIds });
    if (error) { toast.error(`Teilnehmer konnten nicht gespeichert werden: ${error.message}`); return false; }
    return true;
  }

  async function handleCreateWeek(participantIds: string[]) {
    if (!newWeekStart) return;
    setCreatingWeek(true);
    const supabase = createClient();
    const { data: weekId, error } = await supabase.rpc("jourfix_ensure_week", { p_week_start: newWeekStart });
    if (error) {
      toast.error(`Woche konnte nicht angelegt werden: ${error.message}`);
      setCreatingWeek(false);
      return;
    }
    if (participantIds.length > 0) await setWeekParticipants(weekId as string, participantIds);
    const target = newWeekStart;
    setNewWeekStart(null);
    toast.success(`${weekLabel(target)} angelegt`);
    router.push(`/jourfix?week=${target}`);
    router.refresh();
    setCreatingWeek(false);
  }

  async function handleUpdateParticipants(participantIds: string[]) {
    if (!selectedWeek) return;
    markLocalChange();
    const ok = await setWeekParticipants(selectedWeek.id, participantIds);
    setEditingParticipants(false);
    if (ok) router.refresh();
  }

  async function handleDeleteWeek(week: JourfixWeek) {
    const ok = await confirmDialog({
      title: `${weekLabel(week.week_start)} löschen?`,
      description: "Alle Aufgaben und Teilnehmer dieser Woche werden entfernt.",
      confirmLabel: "Woche löschen",
      destructive: true,
    });
    if (!ok) return;
    const supabase = createClient();
    markLocalChange();
    const { error } = await supabase.from("jourfix_weeks").delete().eq("id", week.id);
    if (error) return fail("Woche konnte nicht gelöscht werden", error);
    toast.success("Woche gelöscht");
    if (selectedWeek?.id === week.id) router.push("/jourfix");
    router.refresh();
  }

  async function handleCarryOver() {
    if (!selectedWeek) return;
    setCarrying(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("jourfix_carry_over", { p_week_id: selectedWeek.id });
    setCarrying(false);
    if (error) return fail("Übertrag fehlgeschlagen", error);
    const count = (data as number) ?? 0;
    if (count === 0) toast.info("Alle offenen Aufgaben der Vorwoche sind bereits übernommen.");
    else toast.success(`${count} offene ${count === 1 ? "Aufgabe" : "Aufgaben"} aus der Vorwoche übernommen`);
    router.refresh();
  }

  // ---------- Filter & Kennzahlen ----------
  const q = query.trim().toLowerCase();
  const filterActive = onlyMine || q.length > 0;
  const matches = (t: JourfixTask) =>
    (!onlyMine || t.assignee_id === currentUserId) &&
    (!q ||
      t.title.toLowerCase().includes(q) ||
      (notesByThread.get(t.thread_id) ?? []).some((n) => n.content.toLowerCase().includes(q)));

  const sortedAreas = useMemo(() => [...areas].sort((a, b) => a.position - b.position), [areas]);
  const tasksByArea = useMemo(() => {
    const map = new Map<string, JourfixTask[]>();
    for (const t of sortByPosition(tasks)) {
      const list = map.get(t.area_id) ?? [];
      list.push(t);
      map.set(t.area_id, list);
    }
    return map;
  }, [tasks]);

  const stats = useMemo(() => {
    const open = tasks.filter((t) => !t.done);
    return {
      total: tasks.length,
      open: open.length,
      done: tasks.length - open.length,
      carried: open.filter((t) => t.carried_over_count > 0).length,
      overdue: open.filter((t) => isOverdue(t)).length,
      mine: open.filter((t) => t.assignee_id === currentUserId).length,
    };
  }, [tasks, currentUserId]);
  const pct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

  const doneTasks = useMemo(() => tasks.filter((t) => t.done), [tasks]);
  const topicSuggestionsByArea = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const t of tasks) {
      if (!t.topic) continue;
      const set = map.get(t.area_id) ?? new Set<string>();
      set.add(t.topic);
      map.set(t.area_id, set);
    }
    return new Map([...map].map(([k, v]) => [k, [...v].sort((a, b) => a.localeCompare(b))]));
  }, [tasks]);

  /** Kunde einer Aufgabe in der Kategorie „Kunden“ setzen/ändern. */
  async function handleChangeCustomer(task: JourfixTask, customerId: string) {
    const supabase = createClient();
    markLocalChange();
    if (task.customer_item_id) {
      const { error } = await supabase.from("customer_items").update({ customer_id: customerId }).eq("id", task.customer_item_id);
      if (error) return fail("Kunde konnte nicht geändert werden", error);
    } else {
      // Aufgabe hat noch keinen Kundenpunkt: anlegen und alle Wochen-Kopien verknüpfen
      const { data: item, error } = await supabase
        .from("customer_items")
        .insert({
          customer_id: customerId,
          title: task.title,
          assignee_id: task.assignee_id,
          due_date: task.due_date,
          done: task.done,
          linked_task_id: task.linked_task_id,
          created_by: currentUserId,
        })
        .select("id")
        .single();
      if (error) return fail("Kundenpunkt konnte nicht angelegt werden", error);
      const { error: linkError } = await supabase
        .from("jourfix_tasks")
        .update({ customer_item_id: item.id })
        .eq("thread_id", task.thread_id);
      if (linkError) return fail("Kunde konnte nicht zugeordnet werden", linkError);
    }
    await reloadTask(task.id);
    router.refresh();
  }

  // ---------- Drag & Drop ----------
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const dragSnapshot = useRef<{ tasks: JourfixTask[]; areaId: string } | null>(null);

  const collisionDetection: CollisionDetection = useCallback((args) => {
    const type = args.active.data.current?.type;
    const containers = args.droppableContainers.filter((c) => {
      const t = c.data.current?.type;
      return type === "area" ? t === "area" : t === "task" || t === "area-drop";
    });
    const scoped = { ...args, droppableContainers: containers };
    if (type === "area") return closestCenter(scoped);
    const hits = pointerWithin(scoped);
    const taskHits = hits.filter((h) => containers.find((c) => c.id === h.id)?.data.current?.type === "task");
    if (taskHits.length > 0) {
      return closestCenter({ ...scoped, droppableContainers: containers.filter((c) => taskHits.some((h) => h.id === c.id)) });
    }
    return hits.length > 0 ? hits : closestCenter(scoped);
  }, []);

  function overAreaId(over: DragOverEvent["over"], list: JourfixTask[]) {
    if (!over) return null;
    const data = over.data.current;
    if (data?.type === "area-drop") return data.areaId as string;
    if (data?.type === "task") return list.find((t) => t.id === over.id)?.area_id ?? null;
    return null;
  }

  function handleDragStart({ active }: DragStartEvent) {
    if (active.data.current?.type !== "task") return;
    const task = tasks.find((t) => t.id === active.id) ?? null;
    setActiveDragTask(task);
    if (task) dragSnapshot.current = { tasks, areaId: task.area_id };
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (active.data.current?.type !== "task" || !over) return;
    setTasks((prev) => {
      const activeTask = prev.find((t) => t.id === active.id);
      const targetArea = overAreaId(over, prev);
      if (!activeTask || !targetArea || targetArea === activeTask.area_id) return prev;
      return placeTask(prev, activeTask.id, targetArea, over.data.current?.type === "task" ? (over.id as string) : null);
    });
  }

  async function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveDragTask(null);
    const supabase = createClient();

    if (active.data.current?.type === "area") {
      if (!over || active.id === over.id) return;
      const oldIdx = sortedAreas.findIndex((a) => a.id === active.id);
      const newIdx = sortedAreas.findIndex((a) => a.id === over.id);
      if (oldIdx < 0 || newIdx < 0) return;
      const reordered = arrayMove(sortedAreas, oldIdx, newIdx).map((a, i) => ({ ...a, position: i }));
      markLocalChange();
      setAreas(reordered);
      const { error } = await supabase.rpc("jourfix_reorder_areas", { p_ordered_ids: reordered.map((a) => a.id) });
      if (error) fail("Reihenfolge konnte nicht gespeichert werden", error);
      return;
    }

    const snapshot = dragSnapshot.current;
    dragSnapshot.current = null;
    if (!snapshot) return;
    if (!over) { setTasks(snapshot.tasks); return; }

    const activeTask = tasks.find((t) => t.id === active.id);
    if (!activeTask) return;
    const areaId = activeTask.area_id;
    let areaList = sortByPosition(tasks.filter((t) => t.area_id === areaId && !t.done));

    if (over.data.current?.type === "task" && over.id !== active.id) {
      const oldIdx = areaList.findIndex((t) => t.id === active.id);
      const newIdx = areaList.findIndex((t) => t.id === over.id);
      if (oldIdx >= 0 && newIdx >= 0) areaList = arrayMove(areaList, oldIdx, newIdx);
    }

    const orderedIds = areaList.map((t) => t.id);
    const before = sortByPosition(snapshot.tasks.filter((t) => t.area_id === areaId && !t.done)).map((t) => t.id);
    if (areaId === snapshot.areaId && orderedIds.join() === before.join()) return;

    const pos = new Map(orderedIds.map((id, i) => [id, i]));
    markLocalChange();
    setTasks((prev) => prev.map((t) => (pos.has(t.id) ? { ...t, position: pos.get(t.id)! } : t)));
    const { error } = await supabase.rpc("jourfix_move_task", {
      p_task_id: activeTask.id,
      p_area_id: areaId,
      p_ordered_ids: orderedIds,
    });
    if (error) fail("Verschieben fehlgeschlagen", error);
  }

  function handleDragCancel() {
    setActiveDragTask(null);
    if (dragSnapshot.current) setTasks(dragSnapshot.current.tasks);
    dragSnapshot.current = null;
  }

  const participants = selectedWeek?.participants ?? [];
  const availableCustomerItems = selectedWeek
    ? openCustomerItems.filter((i) => !i.jourfix_tasks.some((j) => j.week_id === selectedWeek.id))
    : [];

  return (
    <div className="flex flex-col min-h-full">
      {/* Kopfbereich */}
      <div className="px-6 pt-6 pb-4 space-y-4 border-b border-slate-200 bg-white">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Jour Fixe</h1>
            <p className="text-sm text-slate-500">Wöchentliche Abstimmung – offene Punkte wandern automatisch in die nächste Woche.</p>
          </div>
        </div>

        <WeekTabs
          weeks={weeks}
          currentWeekStart={currentWeekStart}
          selectedWeekStart={selectedWeekStart}
          isAdmin={isAdmin}
          onSelect={(weekStart) => router.push(`/jourfix?week=${weekStart}`)}
          onOpenNewWeek={() => openNewWeekModal()}
          onDeleteWeek={handleDeleteWeek}
          creatingWeek={creatingWeek}
        />

        {selectedWeek && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {/* Teilnehmer */}
            <div className="flex items-center gap-2 min-w-0">
              <Users className="w-4 h-4 text-slate-400 shrink-0" />
              {participants.length === 0 ? (
                <span className="text-sm text-slate-400">Keine Teilnehmer</span>
              ) : (
                <div className="flex items-center -space-x-1.5" title={participants.map((p) => p.full_name).join(", ")}>
                  {participants.slice(0, 8).map((p) => (
                    <Avatar key={p.id} name={p.full_name || "?"} avatarUrl={p.avatar_url} size={26} className="ring-2 ring-white" />
                  ))}
                  {participants.length > 8 && (
                    <span className="w-[26px] h-[26px] rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold flex items-center justify-center ring-2 ring-white">
                      +{participants.length - 8}
                    </span>
                  )}
                </div>
              )}
              {isAdmin && (
                <button
                  onClick={() => setEditingParticipants(true)}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                  aria-label="Teilnehmer bearbeiten"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Kennzahlen */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Stat icon={CircleDot} label="offen" value={stats.open} className="bg-slate-100 text-slate-700" />
              <Stat icon={CheckCircle2} label="erledigt" value={stats.done} className="bg-emerald-50 text-emerald-700" />
              {stats.carried > 0 && <Stat icon={RotateCw} label="übernommen" value={stats.carried} className="bg-amber-50 text-amber-700" />}
              {stats.overdue > 0 && <Stat icon={AlertTriangle} label="überfällig" value={stats.overdue} className="bg-red-50 text-red-700" />}
              <div className="flex items-center gap-2 ml-1" title={`${pct}% erledigt`}>
                <div className="w-24 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="tabular-nums text-slate-500">{pct}%</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Werkzeugleiste */}
      {selectedWeek && (
        <div className="px-6 py-3 flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50/80">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Aufgaben durchsuchen…"
              className="pl-8 pr-3 py-1.5 w-56 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <FilterChip active={onlyMine} onClick={() => setOnlyMine((v) => !v)} icon={UserRound}>
            Meine{stats.mine > 0 && <span className="ml-1 tabular-nums opacity-70">{stats.mine}</span>}
          </FilterChip>
          {filterActive && (
            <span className="text-xs text-slate-400">Sortieren per Drag &amp; Drop ist bei aktivem Filter deaktiviert</span>
          )}
          {previousWeek && (
            <button
              onClick={handleCarryOver}
              disabled={carrying}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              title={`Offene Aufgaben aus ${weekLabel(previousWeek.week_start)} übernehmen, die hier noch fehlen`}
            >
              {carrying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <History className="w-3.5 h-3.5" />}
              Offene aus Vorwoche nachziehen
            </button>
          )}
        </div>
      )}

      {/* Inhalt */}
      <div className="flex-1 p-6">
        {!selectedWeek ? (
          <div className="flex flex-col items-center justify-center text-center gap-3 py-20">
            <div className="w-12 h-12 rounded-full bg-cyan-50 text-cyan-600 flex items-center justify-center">
              <CalendarPlus className="w-6 h-6" />
            </div>
            <p className="text-slate-700 font-medium">{weekLabel(selectedWeekStart)} ist noch nicht angelegt</p>
            <p className="text-sm text-slate-500 max-w-sm">
              Beim Anlegen werden alle offenen Aufgaben der Vorwoche automatisch übernommen.
            </p>
            <button
              onClick={() => openNewWeekModal(selectedWeekStart)}
              disabled={creatingWeek}
              className="mt-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            >
              Woche anlegen
            </button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetection}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext items={sortedAreas.map((a) => a.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-4">
                {sortedAreas.map((area) => {
                  const all = tasksByArea.get(area.id) ?? [];
                  const open = all.filter((t) => !t.done);
                  return (
                    <AreaCard
                      key={area.id}
                      area={area}
                      tasks={filterActive ? open.filter(matches) : open}
                      totalCount={all.length}
                      openCount={all.filter((t) => !t.done).length}
                      profiles={profiles}
                      projects={projects}
                      customers={customers}
                      availableCustomerItems={availableCustomerItems}
                      isAdmin={isAdmin}
                      dndEnabled={!filterActive}
                      onRename={(name) => handleRenameArea(area.id, name)}
                      onDeleteArea={() => handleDeleteArea(area)}
                      onToggleDone={handleToggleDone}
                      onUpdateTask={handleUpdateTask}
                      onDeleteTask={handleDeleteTask}
                      onAddTask={(params) => handleAddTask(area.id, params)}
                      onAddCustomerItem={handleAddCustomerItem}
                      onLinked={handleLinked}
                      notesByThread={notesByThread}
                      weeks={weeks}
                      currentUserId={currentUserId}
                      noteHandlers={noteHandlers}
                      topicSuggestions={topicSuggestionsByArea.get(area.id) ?? []}
                      onChangeCustomer={handleChangeCustomer}
                    />
                  );
                })}
                {isAdmin && <AddAreaCard onAdd={handleAddArea} />}
              </div>
            </SortableContext>

            {/* Feste Sektion am Ende: nicht löschbar, ein-/ausklappbar */}
            <div className="mt-4">
              <DoneSection
                tasks={filterActive ? doneTasks.filter(matches) : doneTasks}
                areas={sortedAreas}
                profiles={profiles}
                projects={projects}
                customers={customers}
                topicSuggestionsByArea={topicSuggestionsByArea}
                notesByThread={notesByThread}
                weeks={weeks}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                noteHandlers={noteHandlers}
                onToggleDone={handleToggleDone}
                onUpdateTask={handleUpdateTask}
                onDeleteTask={handleDeleteTask}
                onLinked={handleLinked}
                onChangeCustomer={handleChangeCustomer}
              />
            </div>

            <DragOverlay dropAnimation={null}>
              {activeDragTask && (
                <div className="rounded-lg border border-cyan-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-xl rotate-1 max-w-[320px] truncate">
                  {activeDragTask.title}
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}

        {selectedWeek && sortedAreas.length === 0 && !isAdmin && (
          <p className="text-center text-sm text-slate-400 py-16">Es sind noch keine Kategorien angelegt.</p>
        )}
      </div>

      {newWeekStart && (
        <ParticipantsModal
          title="Neue Jour-Fixe-Woche"
          subtitle={`${weekLabel(newWeekStart)} – Teilnehmer auswählen`}
          profiles={profiles}
          initialSelectedIds={(sortedWeeks[0]?.participants ?? []).map((p) => p.id)}
          confirmLabel="Woche anlegen"
          onConfirm={handleCreateWeek}
          onCancel={() => setNewWeekStart(null)}
        />
      )}

      {editingParticipants && selectedWeek && (
        <ParticipantsModal
          title="Teilnehmer bearbeiten"
          subtitle={weekLabel(selectedWeek.week_start)}
          profiles={profiles}
          initialSelectedIds={participants.map((p) => p.id)}
          onConfirm={handleUpdateParticipants}
          onCancel={() => setEditingParticipants(false)}
        />
      )}

      <ConfirmHost />
      <Toaster />
    </div>
  );
}

function Stat({ icon: Icon, label, value, className }: { icon: typeof CircleDot; label: string; value: number; className: string }) {
  return (
    <span className={cn("flex items-center gap-1 px-2 py-1 rounded-full font-medium", className)}>
      <Icon className="w-3 h-3" />
      <span className="tabular-nums">{value}</span> {label}
    </span>
  );
}

function FilterChip({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof CircleDot;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-colors",
        active ? "border-cyan-300 bg-cyan-50 text-cyan-800 font-medium" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      {children}
    </button>
  );
}

function AddAreaCard({ onAdd }: { onAdd: (name: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");

  function submit() {
    if (!name.trim()) return;
    onAdd(name.trim());
    setName("");
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex items-center justify-center gap-1.5 py-3 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-400 hover:border-cyan-300 hover:text-cyan-700 hover:bg-cyan-50/40 transition"
      >
        <Plus className="w-4 h-4" />
        Kategorie hinzufügen
      </button>
    );
  }

  return (
    <div className="border-2 border-dashed border-cyan-300 rounded-xl p-3 flex items-center gap-2 bg-white">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") setEditing(false);
        }}
        placeholder="Name der Kategorie…"
        className="flex-1 min-w-0 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <div className="flex gap-2 shrink-0">
        <button onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-lg text-xs text-slate-600 hover:bg-slate-50">
          Abbrechen
        </button>
        <button onClick={submit} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:opacity-90">
          Anlegen
        </button>
      </div>
    </div>
  );
}
