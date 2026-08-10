import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppLayoutClient from "@/components/AppLayoutClient";

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
    supabase.from("projects").select("id, name, color").order("created_at", { ascending: false }),
  ]);

  return (
    <AppLayoutClient profile={profile} projects={projects ?? []}>
      {children}
    </AppLayoutClient>
  );
}
