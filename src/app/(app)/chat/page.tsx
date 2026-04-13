import { createClient } from "@/lib/supabase/server";
import GlobalChatClient from "@/components/chat/GlobalChatClient";

export default async function GlobalChatPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { project: projectId } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: projects }, { data: profiles }] = await Promise.all([
    supabase.from("projects").select("id, name").order("created_at", { ascending: false }),
    supabase.from("profiles").select("*"),
  ]);

  const activeProjectId = projectId ?? projects?.[0]?.id;

  const { data: messages } = activeProjectId
    ? await supabase
        .from("messages")
        .select("*, profiles:user_id(id, full_name, avatar_url)")
        .eq("project_id", activeProjectId)
        .order("created_at")
        .limit(100)
    : { data: [] };

  const messagesWithProfile = (messages ?? []).map((m: any) => ({
    ...m,
    profile: m.profiles ?? null,
  }));

  return (
    <GlobalChatClient
      projects={projects ?? []}
      activeProjectId={activeProjectId}
      initialMessages={messagesWithProfile}
      currentUserId={user!.id}
      profiles={profiles ?? []}
    />
  );
}
