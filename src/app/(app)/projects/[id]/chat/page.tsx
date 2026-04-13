import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ProjectNav from "@/components/ProjectNav";
import ChatWindow from "@/components/chat/ChatWindow";

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: project }, { data: messages }, { data: { user } }] = await Promise.all([
    supabase.from("projects").select("*, customers(name)").eq("id", id).single(),
    supabase.from("messages").select("*, profile:profiles(id, full_name, avatar_url)").eq("project_id", id).order("created_at", { ascending: true }).limit(100),
    supabase.auth.getUser(),
  ]);

  if (!project || !user) notFound();

  return (
    <div className="flex flex-col h-full">
      <ProjectNav project={project} activeTab="chat" />
      <ChatWindow projectId={id} initialMessages={messages ?? []} currentUserId={user.id} />
    </div>
  );
}
