import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ProjectNav from "@/components/ProjectNav";
import TimelineView from "@/components/timeline/TimelineView";

export default async function TimelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: project }, { data: tasks }, { data: profiles }] = await Promise.all([
    supabase.from("projects").select("*, customers(name)").eq("id", id).single(),
    supabase.from("tasks").select("*, profiles:assignee_id(id, full_name)").eq("project_id", id),
    supabase.from("profiles").select("id, full_name"),
  ]);

  if (!project) notFound();

  return (
    <div className="flex flex-col h-full">
      <ProjectNav project={project} activeTab="timeline" />
      <div className="flex-1 overflow-auto p-6">
        <TimelineView tasks={tasks ?? []} profiles={profiles ?? []} projectId={id} />
      </div>
    </div>
  );
}
