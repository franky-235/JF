"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  Kanban,
  CalendarDays,
  Users,
  MessageSquare,
  UsersRound,
  LogOut,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types";
import { cn } from "@/lib/utils";
import { useState } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projekte", icon: FolderKanban },
  { href: "/board", label: "Aufgaben Board", icon: Kanban },
  { href: "/timeline", label: "Zeitplan", icon: CalendarDays },
  { href: "/customers", label: "Kunden", icon: Users },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/team", label: "Team", icon: UsersRound },
];

const projectColors = [
  "#6366f1", "#22d3ee", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6",
];

type Project = { id: string; name: string; color?: string };

export default function Sidebar({
  profile,
  projects = [],
}: {
  profile: Profile | null;
  projects?: Project[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [projectsOpen, setProjectsOpen] = useState(true);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside className="w-64 flex flex-col shrink-0" style={{ background: "hsl(240 6% 10%)" }}>
      {/* Logo */}
      <div className="flex items-center px-5 py-5">
        <Image src="/logo.svg" alt="nerds" width={120} height={38} priority />
      </div>

      {/* Projects section */}
      <div className="px-3 mb-2">
        <button
          onClick={() => setProjectsOpen((v) => !v)}
          className="flex items-center justify-between w-full px-2 py-1.5 text-xs font-semibold tracking-wider uppercase"
          style={{ color: "hsl(240 5% 45%)" }}
        >
          <span>Projekte</span>
          {projectsOpen ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
        </button>

        {projectsOpen && (
          <div className="mt-1 space-y-0.5">
            {projects.length === 0 && (
              <p className="px-2 py-1 text-xs" style={{ color: "hsl(240 5% 40%)" }}>
                Keine Projekte
              </p>
            )}
            {projects.map((project, i) => {
              const color = projectColors[i % projectColors.length];
              const isActive = pathname.includes(`/projects/${project.id}`);
              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}/board`}
                  className={cn(
                    "flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm transition-colors",
                    isActive
                      ? "bg-[#22d3ee] text-zinc-900 font-medium"
                      : "hover:bg-white/5"
                  )}
                  style={isActive ? {} : { color: "hsl(240 5% 70%)" }}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: color }}
                  />
                  <span className="truncate">{project.name}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="mx-4 mb-2" style={{ borderTop: "1px solid hsl(240 5% 18%)" }} />

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-0.5">
        <p className="px-2 py-1.5 text-xs font-semibold tracking-wider uppercase" style={{ color: "hsl(240 5% 45%)" }}>
          Navigation
        </p>
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-[#22d3ee] text-zinc-900"
                  : "hover:bg-white/5"
              )}
              style={active ? {} : { color: "hsl(240 5% 65%)" }}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-4" style={{ borderTop: "1px solid hsl(240 5% 18%)" }}>
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm shrink-0"
            style={{ background: "#6366f1", color: "white" }}
          >
            {profile?.full_name?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-white">
              {profile?.full_name || "Benutzer"}
            </p>
            <p className="text-xs capitalize" style={{ color: "hsl(240 5% 50%)" }}>
              {profile?.role ?? "member"}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="transition-colors hover:text-red-400"
            style={{ color: "hsl(240 5% 45%)" }}
            title="Abmelden"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
