import { createClient } from "@/lib/supabase/server";
import { startOfWeek, format } from "date-fns";
import JourfixClient from "@/components/jourfix/JourfixClient";
import type { JourfixArea, JourfixTask, JourfixWeek, Profile } from "@/types";

function mondayOf(date: Date) {
  return format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd");
}

export default async function JourfixPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const currentWeekStart = mondayOf(new Date());

  // Self-heal: ensure the current week exists even if the cron job hasn't run yet.
  await supabase.rpc("jourfix_ensure_week", { p_week_start: currentWeekStart });

  const selectedWeekStart = week ?? currentWeekStart;

  const [{ data: profile }, { data: weeks }, { data: areas }, { data: profiles }, { data: projects }] =
    await Promise.all([
      user ? supabase.from("profiles").select("*").eq("id", user.id).single() : Promise.resolve({ data: null }),
      supabase
        .from("jourfix_weeks")
        .select("*")
        .order("week_start", { ascending: false })
        .limit(12),
      supabase.from("jourfix_areas").select("*").order("position"),
      supabase.from("profiles").select("*"),
      supabase
        .from("projects")
        .select("id, name, task_columns(id, title, position)")
        .order("name"),
    ]);

  const selectedWeek = (weeks ?? []).find((w) => w.week_start === selectedWeekStart) ?? null;

  const { data: tasks } = selectedWeek
    ? await supabase
        .from("jourfix_tasks")
        .select("*, assignee:assignee_id(*), linked_task:tasks(id, title, project_id)")
        .eq("week_id", selectedWeek.id)
        .order("created_at")
    : { data: [] };

  return (
    <JourfixClient
      key={selectedWeekStart}
      isAdmin={profile?.role === "admin"}
      currentUserId={user?.id ?? null}
      currentWeekStart={currentWeekStart}
      weeks={(weeks ?? []) as JourfixWeek[]}
      selectedWeekStart={selectedWeekStart}
      selectedWeek={selectedWeek as JourfixWeek | null}
      areas={(areas ?? []) as JourfixArea[]}
      tasks={(tasks ?? []) as JourfixTask[]}
      profiles={(profiles ?? []) as Profile[]}
      projects={(projects ?? []) as { id: string; name: string; task_columns: { id: string; title: string; position: number }[] }[]}
    />
  );
}
