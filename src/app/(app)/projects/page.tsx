import { createClient } from "@/lib/supabase/server";
import ProjectsClient from "./ProjectsClient";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const [{ data: projects }, { data: customers }] = await Promise.all([
    supabase.from("projects").select("*, customers(id, name, company)").order("updated_at", { ascending: false }),
    supabase.from("customers").select("id, name, company").order("name"),
  ]);

  return <ProjectsClient projects={projects ?? []} customers={customers ?? []} />;
}
