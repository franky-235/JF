"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Kanban,
  GitBranch,
  Users,
  MessageSquare,
  FolderOpen,
  Building2,
  LogOut,
  ChevronDown,
  ChevronRight,
  CalendarClock,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types";
import { cn } from "@/lib/utils";
import { useState } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/board", label: "Aufgaben Board", icon: Kanban },
  { href: "/timeline", label: "Zeitplan", icon: GitBranch },
  { href: "/jourfix", label: "Jourfix", icon: CalendarClock },
  { href: "/customers", label: "Kunden", icon: Building2 },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/team", label: "Team", icon: Users },
];

type Project = { id: string; name: string; color?: string };

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function Sidebar({
  profile,
  projects = [],
  open,
  onToggle,
}: {
  profile: Profile | null;
  projects?: Project[];
  open: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [projectsExpanded, setProjectsExpanded] = useState(true);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const avatarColors = ["#6366f1", "#22d3ee", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
  const colorIndex = profile?.full_name ? profile.full_name.charCodeAt(0) % avatarColors.length : 0;
  const avatarColor = avatarColors[colorIndex];

  return (
    <aside
      className={cn(
        "flex-shrink-0 flex flex-col transition-all duration-300 overflow-hidden",
        open ? "w-64" : "w-16"
      )}
      style={{ background: "linear-gradient(180deg, #010707 0%, #565656 100%)" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10">
        {open ? (
          <Image src="/logo.svg" alt="nerds" width={110} height={34} priority className="brightness-0 invert" />
        ) : (
          <Image src="/logo.svg" alt="nerds" width={28} height={28} priority className="brightness-0 invert" style={{ objectFit: "contain", objectPosition: "left" }} />
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <div className="space-y-0.5">
          {/* Dashboard first */}
          <SidebarLink href="/dashboard" icon={LayoutDashboard} label="Dashboard" expanded={open} pathname={pathname} />

          {/* Projects section */}
          {open && (
            <div className="pt-2">
              <button
                onClick={() => setProjectsExpanded((v) => !v)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider hover:text-white transition-colors"
                style={{ color: "#94a3b8" }}
              >
                {projectsExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                Projekte
              </button>
              {projectsExpanded && (
                <div className="ml-2 space-y-0.5 mt-1">
                  {projects.length === 0 && (
                    <p className="px-3 py-1 text-xs" style={{ color: "#64748b" }}>Keine Projekte</p>
                  )}
                  {projects.map((p) => {
                    const isActive = pathname.startsWith(`/projects/${p.id}`);
                    return (
                      <Link
                        key={p.id}
                        href={`/projects/${p.id}/board`}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors",
                          isActive ? "font-semibold" : "text-slate-300 hover:text-white hover:bg-white/10"
                        )}
                        style={isActive ? { backgroundColor: "#00ffff", color: "#000000" } : {}}
                      >
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: p.color || "#6366f1" }}
                        />
                        <span className="truncate">{p.name}</span>
                      </Link>
                    );
                  })}
                  <Link
                    href="/projects"
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors",
                      pathname === "/projects" ? "font-semibold" : "text-slate-400 hover:text-white hover:bg-white/10"
                    )}
                    style={pathname === "/projects" ? { backgroundColor: "#00ffff", color: "#000000" } : {}}
                  >
                    <FolderOpen className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Alle Projekte</span>
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Rest of nav */}
          <div className={cn("space-y-0.5", open ? "pt-2" : "")}>
            {open && (
              <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>
                Navigation
              </div>
            )}
            {navItems.slice(1).map((item) => (
              <SidebarLink key={item.href} href={item.href} icon={item.icon} label={item.label} expanded={open} pathname={pathname} />
            ))}
          </div>
        </div>
      </nav>

      {/* User */}
      <div className="border-t border-white/10 p-3">
        {profile && (
          <div className={cn("flex items-center gap-3", !open && "justify-center")}>
            <Link
              href="/profile"
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 hover:opacity-80 transition-opacity"
              style={{ backgroundColor: avatarColor }}
            >
              {getInitials(profile.full_name || "?")}
            </Link>
            {open && (
              <>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-medium truncate">{profile.full_name}</div>
                  <div className="text-xs capitalize truncate" style={{ color: "#94a3b8" }}>
                    {profile.role === "admin" ? "Administrator" : "Mitglied"}
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="transition-colors p-1 hover:text-red-400"
                  style={{ color: "#64748b" }}
                  title="Abmelden"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

function SidebarLink({
  href,
  icon: Icon,
  label,
  expanded,
  pathname,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  expanded: boolean;
  pathname: string;
}) {
  const isActive = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors",
        isActive ? "font-semibold" : "text-slate-300 hover:text-white hover:bg-white/10",
        !expanded && "justify-center"
      )}
      style={isActive ? { backgroundColor: "#00ffff", color: "#000000" } : {}}
      title={!expanded ? label : undefined}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      {expanded && <span>{label}</span>}
    </Link>
  );
}
