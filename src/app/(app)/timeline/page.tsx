import { createClient } from "@/lib/supabase/server";
import TimelineView from "@/components/timeline/TimelineView";
import GlobalTimelineHeader from "@/components/timeline/GlobalTimelineHeader";

export default async function GlobalTimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { project: projectId } = await searchParams;
  const supabase = await createClient();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .order("created_at", { ascending: false });

  const activeProjectId = projectId ?? projects?.[0]?.id;

  const [{ data: tasks }, { data: profiles }] = await Promise.all([
    activeProjectId
      ? supabase
          .from("tasks")
          .select("*, task_columns(title, color)")
          .eq("project_id", activeProjectId)
          .not("due_date", "is", null)
          .order("due_date")
      : Promise.resolve({ data: [] }),
    supabase.from("profiles").select("id, full_name, avatar_url"),
  ]);

  return (
    <div className="flex flex-col h-full">
      <GlobalTimelineHeader
        projects={projects ?? []}
        activeProjectId={activeProjectId}
      />
      <div className="flex-1 overflow-hidden">
        {activeProjectId ? (
          <TimelineView tasks={tasks ?? []} profiles={profiles ?? []} projectId={activeProjectId} />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>Noch keine Projekte vorhanden.</p>
          </div>
        )}
      </div>
    </div>
  );
}
