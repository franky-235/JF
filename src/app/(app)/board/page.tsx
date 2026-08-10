import { createClient } from "@/lib/supabase/server";
import KanbanBoardClient from "@/components/board/KanbanBoardClient";
import GlobalBoardHeader from "@/components/board/GlobalBoardHeader";

export default async function GlobalBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; priority?: string }>;
}) {
  const { project: projectId, priority } = await searchParams;
  const supabase = await createClient();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .order("created_at", { ascending: false });

  const activeProjectId = projectId ?? projects?.[0]?.id;

  const [{ data: project }, { data: columns }, { data: profiles }] = await Promise.all([
    activeProjectId
      ? supabase.from("projects").select("*, customers(name)").eq("id", activeProjectId).single()
      : Promise.resolve({ data: null }),
    activeProjectId
      ? supabase
          .from("task_columns")
          .select("*, tasks(*, profiles:assignee_id(id, full_name, avatar_url))")
          .eq("project_id", activeProjectId)
          .order("position")
      : Promise.resolve({ data: [] }),
    supabase.from("profiles").select("*"),
  ]);

  const sortedColumns = (columns ?? []).map((col) => ({
    ...col,
    tasks: (col.tasks ?? [])
      .filter((t: any) => !priority || t.priority === priority)
      .sort((a: any, b: any) => a.position - b.position),
  }));

  return (
    <div className="flex flex-col h-full">
      <GlobalBoardHeader
        projects={projects ?? []}
        activeProjectId={activeProjectId}
        taskCount={sortedColumns.reduce((acc, col) => acc + col.tasks.length, 0)}
        columnCount={sortedColumns.length}
        activePriority={priority}
      />
      <div className="flex-1 overflow-hidden">
        {activeProjectId ? (
          <KanbanBoardClient
            columns={sortedColumns}
            projectId={activeProjectId}
            profiles={profiles ?? []}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>Noch keine Projekte vorhanden.</p>
          </div>
        )}
      </div>
    </div>
  );
}
