import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: profile }, { data: projects }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("projects").select("id, name, status").order("created_at", { ascending: false }),
  ]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar profile={profile} projects={projects ?? []} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar profile={profile} />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
