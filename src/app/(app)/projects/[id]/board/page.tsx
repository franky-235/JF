import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import KanbanBoardClient from "@/components/board/KanbanBoardClient";
import ProjectNav from "@/components/ProjectNav";

export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: project }, { data: columns }, { data: profiles }] = await Promise.all([
    supabase.from("projects").select("*, customers(name)").eq("id", id).single(),
    supabase.from("task_columns").select("*, tasks(*, profiles:assignee_id(id, full_name, avatar_url))").eq("project_id", id).order("position"),
    supabase.from("profiles").select("*"),
  ]);

  if (!project) notFound();

  const sortedColumns = (columns ?? []).map((col) => ({
    ...col,
    tasks: (col.tasks ?? []).sort((a: any, b: any) => a.position - b.position),
  }));

  return (
    <div className="flex flex-col h-full">
      <ProjectNav project={project} activeTab="board" />
      <div className="flex-1 overflow-hidden">
        <KanbanBoardClient columns={sortedColumns} projectId={id} profiles={profiles ?? []} />
      </div>
    </div>
  );
}
