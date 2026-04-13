import { createClient } from "@/lib/supabase/server";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const supabase = await createClient();
  const [{ data: { user } }, { data: profiles }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("profiles").select("*").order("full_name"),
  ]);

  const currentProfile = profiles?.find((p) => p.id === user?.id) ?? null;

  return <SettingsClient profiles={profiles ?? []} currentProfile={currentProfile} currentUserId={user?.id ?? ""} />;
}
