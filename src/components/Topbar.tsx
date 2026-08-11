"use client";

import { Bell, Search, Menu, X, AlertTriangle, Clock, AtSign, CheckCircle2, Trash2 } from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types";
import Avatar from "@/components/Avatar";

type Project = { id: string; name: string; color?: string };

type NotificationType = "overdue" | "soon" | "mention";

interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  time: string;
  icon: typeof AlertTriangle;
  link: string;
}

const colorMap: Record<NotificationType, string> = {
  overdue: "text-red-500 bg-red-50",
  soon: "text-amber-500 bg-amber-50",
  mention: "text-cyan-600 bg-cyan-50",
};

function isDone(t: { task_columns?: { title: string } | null }) {
  const title = (t.task_columns?.title ?? "").toLowerCase();
  return title.includes("erledigt") || title.includes("done");
}

const DISMISSED_KEY = "pm:dismissed-notifs";

export default function Topbar({
  profile,
  projects = [],
  sidebarOpen,
  onSidebarToggle,
}: {
  profile: Profile | null;
  projects?: Project[];
  sidebarOpen?: boolean;
  onSidebarToggle?: () => void;
}) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  const [myTasks, setMyTasks] = useState<any[]>([]);
  const [mentionMessages, setMentionMessages] = useState<any[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]"));
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
    }
    if (notificationsOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [notificationsOpen]);

  useEffect(() => {
    if (!profile) return;
    const supabase = createClient();
    const projectIds = projects.map((p) => p.id);

    supabase
      .from("tasks")
      .select("id, title, due_date, project_id, task_columns(title), projects(name)")
      .eq("assignee_id", profile.id)
      .then(({ data }) => setMyTasks(data ?? []));

    if (projectIds.length > 0) {
      supabase
        .from("messages")
        .select("id, project_id, user_id, content, created_at, profile:profiles(full_name)")
        .in("project_id", projectIds)
        .order("created_at", { ascending: false })
        .limit(200)
        .then(({ data }) => setMentionMessages(data ?? []));
    }
  }, [profile?.id, projects.length]);

  const notifications = useMemo<NotificationItem[]>(() => {
    if (!profile) return [];
    const now = new Date();
    const in2days = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const firstName = (profile.full_name || "").split(" ")[0]?.toLowerCase();
    const items: NotificationItem[] = [];

    for (const t of myTasks) {
      if (!t.due_date || isDone(t)) continue;
      const due = new Date(t.due_date);
      const projectName = t.projects?.name;
      if (due < now) {
        items.push({
          id: `overdue-${t.id}`,
          type: "overdue",
          title: "Überfällig",
          message: `${t.title}${projectName ? ` · ${projectName}` : ""}`,
          time: due.toLocaleDateString("de-DE"),
          icon: AlertTriangle,
          link: "/board",
        });
      } else if (due <= in2days) {
        items.push({
          id: `soon-${t.id}`,
          type: "soon",
          title: "Fällig in Kürze",
          message: `${t.title}${projectName ? ` · ${projectName}` : ""}`,
          time: due.toLocaleDateString("de-DE"),
          icon: Clock,
          link: "/board",
        });
      }
    }

    if (firstName) {
      for (const m of mentionMessages) {
        if (m.user_id === profile.id) continue;
        if (!m.content?.toLowerCase().includes(`@${firstName}`)) continue;
        const sender = m.profile?.full_name ?? "Jemand";
        items.push({
          id: `mention-${m.id}`,
          type: "mention",
          title: "Du wurdest erwähnt",
          message: `${sender}: „${m.content.slice(0, 60)}${m.content.length > 60 ? "…" : ""}"`,
          time: new Date(m.created_at).toLocaleDateString("de-DE"),
          icon: AtSign,
          link: "/chat",
        });
      }
    }

    return items.filter((n) => !dismissed.has(n.id)).slice(0, 20);
  }, [profile, myTasks, mentionMessages, dismissed]);

  function persistDismissed(next: Set<string>) {
    setDismissed(next);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...next]));
  }

  function dismissOne(id: string) {
    persistDismissed(new Set([...dismissed, id]));
  }

  function dismissAll() {
    persistDismissed(new Set([...dismissed, ...notifications.map((n) => n.id)]));
  }

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center px-4 gap-3 flex-shrink-0 relative">
      {/* Sidebar toggle */}
      {onSidebarToggle && (
        <button
          onClick={onSidebarToggle}
          className="text-slate-400 hover:text-slate-600 transition-colors"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      )}

      {/* Search */}
      <div className="flex-1 flex items-center gap-3">
        <div className="relative max-w-xs w-full hidden md:block">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Suchen..."
            className="w-full pl-9 pr-4 py-1.5 bg-slate-100 rounded-lg text-sm text-slate-700 placeholder-slate-400 border border-transparent focus:outline-none focus:bg-white transition-all"
            onFocus={(e) => {
              e.target.style.borderColor = "#00ffff";
              e.target.style.boxShadow = "0 0 0 2px #00ffff30";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "transparent";
              e.target.style.boxShadow = "";
            }}
          />
        </div>
      </div>

      {/* Bell */}
      <div className="relative" ref={notificationRef}>
        <button
          onClick={() => setNotificationsOpen((v) => !v)}
          className="relative text-slate-400 hover:text-slate-600 transition-colors p-2"
        >
          <Bell className="w-5 h-5" />
          {notifications.length > 0 && (
            <span
              className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
              style={{ backgroundColor: "#00ffff" }}
            />
          )}
        </button>

        {/* Notifications dropdown */}
        {notificationsOpen && (
          <div className="absolute top-12 right-0 w-96 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Benachrichtigungen</h3>
              {notifications.length > 0 && (
                <span
                  className="text-xs px-2 py-1 rounded-full font-medium text-black"
                  style={{ backgroundColor: "#00ffff" }}
                >
                  {notifications.length} Neu
                </span>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <CheckCircle2 className="w-10 h-10 mb-3 text-emerald-300" />
                  <p className="text-sm font-medium">Alles erledigt!</p>
                  <p className="text-xs mt-1">Keine neuen Benachrichtigungen</p>
                </div>
              ) : (
                notifications.map((notif) => {
                  const Icon = notif.icon;
                  return (
                    <div
                      key={notif.id}
                      className="p-4 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0 cursor-pointer group"
                      onClick={() => {
                        router.push(notif.link);
                        setNotificationsOpen(false);
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${colorMap[notif.type]}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-slate-800 mb-0.5">{notif.title}</h4>
                          <p className="text-sm text-slate-500 mb-1 leading-snug">{notif.message}</p>
                          <span className="text-xs text-slate-400">{notif.time}</span>
                        </div>
                        <button
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            dismissOne(notif.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {notifications.length > 0 && (
              <div className="p-3 border-t border-slate-200 bg-slate-50">
                <button
                  className="w-full text-sm font-medium py-2 hover:bg-white rounded-lg transition-colors"
                  style={{ color: "#00aaaa" }}
                  onClick={dismissAll}
                >
                  Alle als gelesen markieren
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* User */}
      {profile && (
        <button
          onClick={() => router.push("/profile")}
          className="flex items-center gap-2 cursor-pointer group"
        >
          <Avatar name={profile.full_name || "?"} avatarUrl={profile.avatar_url} size={32} />
          <div className="hidden md:block text-left">
            <div className="text-sm font-medium text-slate-700 group-hover:text-[#009999] transition-colors">
              {profile.full_name?.split(" ")[0] || "Benutzer"}
            </div>
            <div className="text-xs text-slate-400 capitalize">{profile.role ?? "member"}</div>
          </div>
        </button>
      )}
    </header>
  );
}
