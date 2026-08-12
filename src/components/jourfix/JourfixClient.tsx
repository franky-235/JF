"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, format, getISOWeek } from "date-fns";
import { de } from "date-fns/locale";
import { Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { JourfixArea, JourfixTask, JourfixWeek, Profile } from "@/types";
import WeekTabs from "./WeekTabs";
import AreaCard from "./AreaCard";
import ParticipantsModal from "./ParticipantsModal";
import Avatar from "@/components/Avatar";

function weekLabel(weekStart: string) {
  const start = new Date(`${weekStart}T00:00:00`);
  const end = addDays(start, 4);
  return `KW ${getISOWeek(start)} · ${format(start, "dd.MM.", { locale: de })}–${format(end, "dd.MM.yyyy", { locale: de })}`;
}

export type ProjectOption = {
  id: string;
  name: string;
  task_columns: { id: string; title: string; position: number }[];
};

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
}: Props) {
  const router = useRouter();
  const [areas, setAreas] = useState(initialAreas);
  const [tasks, setTasks] = useState(initialTasks);
  const [creatingWeek, setCreatingWeek] = useState(false);
  const [newWeekStart, setNewWeekStart] = useState<string | null>(null);
  const [editingParticipants, setEditingParticipants] = useState(false);
  const localChangeRef = useRef(false);

  useEffect(() => {
    if (!selectedWeek) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`jourfix-${selectedWeek.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jourfix_tasks", filter: `week_id=eq.${selectedWeek.id}` },
        () => {
          if (localChangeRef.current) return;
          router.refresh();
        }
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "jourfix_areas" }, () => {
        if (localChangeRef.current) return;
        router.refresh();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedWeek, router]);

  function markLocalChange() {
    localChangeRef.current = true;
    setTimeout(() => {
      localChangeRef.current = false;
    }, 2000);
  }

  function enrichTask(task: JourfixTask): JourfixTask {
    return {
      ...task,
      assignee: profiles.find((p) => p.id === task.assignee_id) ?? null,
    };
  }

  async function handleAddArea(name: string) {
    const supabase = createClient();
    markLocalChange();
    const { data, error } = await supabase
      .from("jourfix_areas")
      .insert({ name, position: areas.length, created_by: currentUserId })
      .select()
      .single();
    if (error) { alert(`Bereich konnte nicht angelegt werden: ${error.message}`); return; }
    if (data) setAreas((prev) => [...prev, data]);
  }

  async function handleRenameArea(areaId: string, name: string) {
    const supabase = createClient();
    markLocalChange();
    setAreas((prev) => prev.map((a) => (a.id === areaId ? { ...a, name } : a)));
    const { error } = await supabase.from("jourfix_areas").update({ name }).eq("id", areaId);
    if (error) alert(`Umbenennen fehlgeschlagen: ${error.message}`);
  }

  async function handleDeleteArea(areaId: string) {
    const supabase = createClient();
    markLocalChange();
    setAreas((prev) => prev.filter((a) => a.id !== areaId));
    setTasks((prev) => prev.filter((t) => t.area_id !== areaId));
    const { error } = await supabase.from("jourfix_areas").delete().eq("id", areaId);
    if (error) { alert(`Bereich konnte nicht gelöscht werden: ${error.message}`); router.refresh(); }
  }

  async function handleToggleDone(taskId: string, done: boolean) {
    const supabase = createClient();
    markLocalChange();
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, done } : t)));
    const { error } = await supabase.from("jourfix_tasks").update({ done }).eq("id", taskId);
    if (error) alert(`Aufgabe konnte nicht aktualisiert werden: ${error.message}`);
  }

  async function handleUpdateTaskDetails(taskId: string, details: string) {
    const supabase = createClient();
    markLocalChange();
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, details } : t)));
    const { error } = await supabase.from("jourfix_tasks").update({ details }).eq("id", taskId);
    if (error) alert(`Details konnten nicht gespeichert werden: ${error.message}`);
  }

  async function handleDeleteTask(taskId: string) {
    const supabase = createClient();
    markLocalChange();
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    const { error } = await supabase.from("jourfix_tasks").delete().eq("id", taskId);
    if (error) { alert(`Aufgabe konnte nicht gelöscht werden: ${error.message}`); router.refresh(); }
  }

  async function handleAssign(taskId: string, assigneeId: string | null) {
    const supabase = createClient();
    markLocalChange();
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, assignee_id: assigneeId, assignee: profiles.find((p) => p.id === assigneeId) ?? null } : t)));
    const { error } = await supabase.from("jourfix_tasks").update({ assignee_id: assigneeId }).eq("id", taskId);
    if (error) alert(`Zuweisung fehlgeschlagen: ${error.message}`);
  }

  async function handleAddTask(params: {
    areaId: string;
    title: string;
    assigneeId: string | null;
    linkToBoard: boolean;
    projectId?: string;
    columnId?: string;
  }) {
    if (!selectedWeek) return;
    const supabase = createClient();
    markLocalChange();

    let linkedTask: { id: string; title: string; project_id: string } | null = null;

    if (params.linkToBoard && params.projectId && params.columnId) {
      const { data: newTask, error: linkError } = await supabase
        .from("tasks")
        .insert({
          project_id: params.projectId,
          column_id: params.columnId,
          title: params.title,
          assignee_id: params.assigneeId,
          position: 9999,
          created_by: currentUserId,
        })
        .select()
        .single();
      if (linkError) { alert(`Board-Aufgabe konnte nicht angelegt werden: ${linkError.message}`); return; }
      if (newTask) linkedTask = { id: newTask.id, title: newTask.title, project_id: newTask.project_id };
    }

    const { data: jourfixTask, error } = await supabase
      .from("jourfix_tasks")
      .insert({
        week_id: selectedWeek.id,
        area_id: params.areaId,
        title: params.title,
        assignee_id: params.assigneeId,
        linked_task_id: linkedTask?.id ?? null,
        created_by: currentUserId,
      })
      .select()
      .single();

    if (error) { alert(`Aufgabe konnte nicht angelegt werden: ${error.message}`); return; }
    if (jourfixTask) {
      setTasks((prev) => [...prev, enrichTask({ ...jourfixTask, linked_task: linkedTask })]);
    }
  }

  function openNewWeekModal(explicitWeekStart?: string) {
    let target = explicitWeekStart;
    if (!target) {
      const latest = weeks[0]?.week_start ?? currentWeekStart;
      target = format(addDays(new Date(`${latest}T00:00:00`), 7), "yyyy-MM-dd");
    }
    setNewWeekStart(target);
  }

  async function setWeekParticipants(weekId: string, participantIds: string[]) {
    const supabase = createClient();
    const { error: delError } = await supabase.from("jourfix_week_participants").delete().eq("week_id", weekId);
    if (delError) { alert(`Teilnehmer konnten nicht gespeichert werden: ${delError.message}`); return false; }
    if (participantIds.length > 0) {
      const { error } = await supabase
        .from("jourfix_week_participants")
        .insert(participantIds.map((user_id) => ({ week_id: weekId, user_id })));
      if (error) { alert(`Teilnehmer konnten nicht gespeichert werden: ${error.message}`); return false; }
    }
    return true;
  }

  async function handleCreateWeek(participantIds: string[]) {
    if (!newWeekStart) return;
    setCreatingWeek(true);
    const supabase = createClient();
    const { data: weekId, error } = await supabase.rpc("jourfix_ensure_week", { p_week_start: newWeekStart });
    if (error) { alert(`Woche konnte nicht angelegt werden: ${error.message}`); setCreatingWeek(false); return; }
    await setWeekParticipants(weekId as string, participantIds);
    const target = newWeekStart;
    setNewWeekStart(null);
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

  async function handleDeleteWeek(weekId: string) {
    const supabase = createClient();
    markLocalChange();
    const { error } = await supabase.from("jourfix_weeks").delete().eq("id", weekId);
    if (error) { alert(`Zeitraum konnte nicht gelöscht werden: ${error.message}`); return; }
    if (selectedWeek?.id === weekId) {
      router.push("/jourfix");
    }
    router.refresh();
  }

  const tasksByArea = new Map<string, JourfixTask[]>();
  for (const task of tasks) {
    const list = tasksByArea.get(task.area_id) ?? [];
    list.push(task);
    tasksByArea.set(task.area_id, list);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4">
        <h1 className="text-lg font-semibold">Jourfix</h1>
        <p className="text-sm text-muted-foreground">Aufgabenbereiche, wöchentlich fortgeschrieben</p>
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
        <div className="flex items-center gap-2 px-6 py-1.5 border-b text-xs text-muted-foreground">
          <span className="font-medium shrink-0">Teilnehmer:</span>
          {(selectedWeek.participants ?? []).length === 0 ? (
            <span>Keine ausgewählt</span>
          ) : (
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              {(selectedWeek.participants ?? []).map((p) => (
                <span key={p.id} className="flex items-center gap-1 shrink-0">
                  <Avatar name={p.full_name || "?"} avatarUrl={p.avatar_url} size={16} />
                  {p.full_name || "(kein Name)"}
                </span>
              ))}
            </div>
          )}
          {isAdmin && (
            <button
              onClick={() => setEditingParticipants(true)}
              className="ml-auto shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              title="Teilnehmer bearbeiten"
            >
              <Pencil className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6">
        {!selectedWeek ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 text-muted-foreground">
            <p>Diese Woche wurde noch nicht angelegt.</p>
            <button
              onClick={() => openNewWeekModal(selectedWeekStart)}
              disabled={creatingWeek}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 disabled:opacity-50"
            >
              Woche anlegen
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {areas.map((area) => (
              <AreaCard
                key={area.id}
                area={area}
                tasks={(tasksByArea.get(area.id) ?? []).sort((a, b) => a.created_at.localeCompare(b.created_at))}
                profiles={profiles}
                projects={projects}
                isAdmin={isAdmin}
                onRename={(name) => handleRenameArea(area.id, name)}
                onDeleteArea={() => handleDeleteArea(area.id)}
                onToggleDone={handleToggleDone}
                onAssign={handleAssign}
                onUpdateTaskDetails={handleUpdateTaskDetails}
                onDeleteTask={handleDeleteTask}
                onAddTask={(params) => handleAddTask({ ...params, areaId: area.id })}
              />
            ))}
          </div>
        )}

        {isAdmin && selectedWeek && <AddAreaButton onAdd={handleAddArea} />}
      </div>

      {newWeekStart && (
        <ParticipantsModal
          title="Neuer Jourfix-Zeitraum"
          subtitle={`Teilnehmende Mitglieder für ${weekLabel(newWeekStart)} auswählen`}
          profiles={profiles}
          initialSelectedIds={[]}
          onConfirm={handleCreateWeek}
          onCancel={() => setNewWeekStart(null)}
        />
      )}

      {editingParticipants && selectedWeek && (
        <ParticipantsModal
          title="Teilnehmer bearbeiten"
          subtitle={weekLabel(selectedWeek.week_start)}
          profiles={profiles}
          initialSelectedIds={(selectedWeek.participants ?? []).map((p) => p.id)}
          onConfirm={handleUpdateParticipants}
          onCancel={() => setEditingParticipants(false)}
        />
      )}
    </div>
  );
}

function AddAreaButton({ onAdd }: { onAdd: (name: string) => void }) {
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
        className="mt-4 flex items-center gap-2 px-4 py-2.5 border-2 border-dashed rounded-xl text-muted-foreground hover:border-primary hover:text-primary transition text-sm"
      >
        + Bereich hinzufügen
      </button>
    );
  }

  return (
    <div className="mt-4 flex items-center gap-2 max-w-sm">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") setEditing(false);
        }}
        placeholder="Name des Bereichs..."
        className="flex-1 px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <button onClick={submit} className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90">
        Anlegen
      </button>
      <button onClick={() => setEditing(false)} className="px-3 py-2 border rounded-lg text-sm hover:bg-accent">
        Abbrechen
      </button>
    </div>
  );
}
