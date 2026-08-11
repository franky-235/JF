"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import type { JourfixArea, JourfixTask, JourfixWeek, Profile } from "@/types";
import WeekTabs from "./WeekTabs";
import AreaCard from "./AreaCard";

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

  async function handleToggleDone(taskId: string, done: boolean) {
    const supabase = createClient();
    markLocalChange();
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, done } : t)));
    const { error } = await supabase.from("jourfix_tasks").update({ done }).eq("id", taskId);
    if (error) alert(`Aufgabe konnte nicht aktualisiert werden: ${error.message}`);
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

  async function handleEnsureNextWeek() {
    setCreatingWeek(true);
    const latest = weeks[0]?.week_start ?? currentWeekStart;
    const nextWeekStart = format(addDays(new Date(`${latest}T00:00:00`), 7), "yyyy-MM-dd");
    const supabase = createClient();
    const { error } = await supabase.rpc("jourfix_ensure_week", { p_week_start: nextWeekStart });
    if (error) { alert(`Woche konnte nicht angelegt werden: ${error.message}`); setCreatingWeek(false); return; }
    router.push(`/jourfix?week=${nextWeekStart}`);
    router.refresh();
    setCreatingWeek(false);
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
        onEnsureNextWeek={handleEnsureNextWeek}
        onDeleteWeek={handleDeleteWeek}
        creatingWeek={creatingWeek}
      />

      <div className="flex-1 overflow-y-auto p-6">
        {!selectedWeek ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 text-muted-foreground">
            <p>Diese Woche wurde noch nicht angelegt.</p>
            <button
              onClick={handleEnsureNextWeek}
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
                onToggleDone={handleToggleDone}
                onAssign={handleAssign}
                onAddTask={(params) => handleAddTask({ ...params, areaId: area.id })}
              />
            ))}
          </div>
        )}

        {isAdmin && selectedWeek && <AddAreaButton onAdd={handleAddArea} />}
      </div>
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
