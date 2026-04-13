"use client";

import { useRouter } from "next/navigation";
import ChatWindow from "./ChatWindow";
import type { Profile } from "@/types";

interface Project { id: string; name: string }
interface MessageWithProfile {
  id: string;
  project_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
}

interface Props {
  projects: Project[];
  activeProjectId?: string;
  initialMessages: MessageWithProfile[];
  currentUserId: string;
  profiles: Profile[];
}

const dotColors = ["#6366f1", "#22d3ee", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function GlobalChatClient({
  projects,
  activeProjectId,
  initialMessages,
  currentUserId,
  profiles,
}: Props) {
  const router = useRouter();
  const activeProject = projects.find((p) => p.id === activeProjectId);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: project list */}
      <div className="w-72 border-r flex flex-col bg-card shrink-0">
        <div className="px-4 py-4 border-b">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <span>💬</span> Projekt Chats
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {projects.map((project, i) => {
            const isActive = project.id === activeProjectId;
            const color = dotColors[i % dotColors.length];
            return (
              <button
                key={project.id}
                onClick={() => router.push(`/chat?project=${project.id}`)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                  isActive ? "bg-primary/10 border-r-2 border-primary" : "hover:bg-accent"
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: color }}
                />
                <div className="min-w-0">
                  <p className={`text-sm font-medium truncate ${isActive ? "text-primary" : ""}`}>
                    {project.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {profiles.length} Mitglieder
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Online members */}
        <div className="px-4 py-3 border-t">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Team Online
          </p>
          <div className="space-y-1.5">
            {profiles.slice(0, 5).map((profile, i) => {
              const color = dotColors[i % dotColors.length];
              return (
                <div key={profile.id} className="flex items-center gap-2">
                  <div className="relative">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold text-white"
                      style={{ background: color }}
                    >
                      {profile.full_name?.[0]?.toUpperCase() ?? "?"}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full border border-card" />
                  </div>
                  <span className="text-xs">{profile.full_name?.split(" ")[0]}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right: chat area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Chat header */}
        {activeProject && (
          <div className="flex items-center gap-3 px-6 py-4 border-b bg-card shrink-0">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: dotColors[projects.indexOf(activeProject) % dotColors.length] }}
            />
            <div>
              <h2 className="font-semibold text-sm">{activeProject.name}</h2>
              <p className="text-xs text-muted-foreground">
                {profiles.length} Mitglieder · Projekt Chat
              </p>
            </div>
          </div>
        )}

        {activeProjectId ? (
          <ChatWindow
            projectId={activeProjectId}
            initialMessages={initialMessages}
            currentUserId={currentUserId}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <p>Kein Projekt ausgewählt.</p>
          </div>
        )}
      </div>
    </div>
  );
}
