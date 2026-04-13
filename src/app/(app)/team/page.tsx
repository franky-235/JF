import { createClient } from "@/lib/supabase/server";
import TeamClient from "./TeamClient";

export default async function TeamPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: profiles }, { data: currentProfile }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at"),
    supabase.from("profiles").select("*").eq("id", user!.id).single(),
  ]);

  return <TeamClient profiles={profiles ?? []} currentProfile={currentProfile} />;
}
