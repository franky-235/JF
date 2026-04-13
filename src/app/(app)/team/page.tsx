import { createClient } from "@/lib/supabase/server";
import TeamClient from "./TeamClient";

export default async function TeamPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Auto-promote current user to admin if no admins exist yet
  const { count: adminCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("role", "admin");

  if ((adminCount ?? 0) === 0 && user) {
    await supabase.from("profiles").update({ role: "admin" }).eq("id", user.id);
  }

  const [{ data: profiles }, { data: currentProfile }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at"),
    supabase.from("profiles").select("*").eq("id", user!.id).single(),
  ]);

  return (
    <TeamClient
      profiles={profiles ?? []}
      currentProfile={currentProfile}
      currentEmail={user!.email ?? null}
    />
  );
}
