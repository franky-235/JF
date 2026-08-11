"use client";

import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
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

const userColors = ["#6366f1", "#22d3ee", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
const projectColors = ["#6366f1", "#22d3ee", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

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
    <div className="flex bg-white rounded-xl border border-slate-200 overflow-hidden" style={{ height: "calc(100vh - 56px)" }}>
      {/* Left: project list */}
      <div className="w-64 flex-shrink-0 bg-slate-50 border-r border-slate-200 flex flex-col">
        <div className="px-4 py-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" style={{ color: "#00aaaa" }} />
            Projekt Chats
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {projects.map((project, i) => {
            const isActive = project.id === activeProjectId;
            const color = projectColors[i % projectColors.length];
            return (
              <button
                key={project.id}
                onClick={() => router.push(`/chat?project=${project.id}`)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${isActive ? "border-r-2" : "hover:bg-slate-100"}`}
                style={isActive ? { backgroundColor: "#00ffff15", borderRightColor: "#00ffff" } : {}}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium truncate"
                    style={isActive ? { color: "#007777" } : { color: "#334155" }}
                  >
                    {project.name}
                  </p>
                  <p className="text-xs text-slate-400">{profiles.length} Mitglieder</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Online members */}
        <div className="border-t border-slate-200 p-3">
          <p className="text-xs text-slate-400 font-medium mb-2">Team Online</p>
          <div className="space-y-1.5">
            {profiles.slice(0, 5).map((profile, i) => {
              const color = userColors[i % userColors.length];
              const isMe = profile.id === currentUserId;
              return (
                <div key={profile.id} className="flex items-center gap-2">
                  <div className="relative">
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt={profile.full_name} className="w-6 h-6 rounded-full object-cover" />
                    ) : (
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                        style={{ background: color }}
                      >
                        {profile.full_name?.[0]?.toUpperCase() ?? "?"}
                      </div>
                    )}
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-50 ${isMe ? "bg-emerald-400" : "bg-slate-300"}`}
                    />
                  </div>
                  <span className="text-xs text-slate-600 truncate">{profile.full_name?.split(" ")[0]}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right: chat area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Chat header */}
        {activeProject && (
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-200 bg-white shrink-0">
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ background: projectColors[projects.indexOf(activeProject) % projectColors.length] }}
            />
            <div>
              <h3 className="text-sm font-semibold text-slate-800">{activeProject.name}</h3>
              <p className="text-xs text-slate-400">{profiles.length} Mitglieder · Projekt Chat</p>
            </div>
          </div>
        )}

        {activeProjectId ? (
          <ChatWindow
            projectId={activeProjectId}
            initialMessages={initialMessages}
            currentUserId={currentUserId}
            projectName={activeProject?.name}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400">
            <MessageSquare className="w-10 h-10 text-slate-200" />
            <p className="text-sm">Kein Projekt ausgewählt.</p>
          </div>
        )}
      </div>
    </div>
  );
}
