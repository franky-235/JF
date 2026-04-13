"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Calendar, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { key: "board", label: "Board", icon: LayoutGrid, href: (id: string) => `/projects/${id}/board` },
  { key: "timeline", label: "Timeline", icon: Calendar, href: (id: string) => `/projects/${id}/timeline` },
  { key: "chat", label: "Chat", icon: MessageSquare, href: (id: string) => `/projects/${id}/chat` },
];

export default function ProjectNav({
  project,
  activeTab,
}: {
  project: { id: string; name: string; customers?: { name: string } | null };
  activeTab: string;
}) {
  return (
    <div className="border-b bg-card px-6 pt-5 pb-0">
      <div className="mb-3">
        <p className="text-xs text-muted-foreground mb-0.5">
          {(project.customers as any)?.name ?? "Kein Kunde"}
        </p>
        <h1 className="text-xl font-bold">{project.name}</h1>
      </div>
      <div className="flex gap-1">
        {tabs.map(({ key, label, icon: Icon, href }) => (
          <Link
            key={key}
            href={href(project.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              activeTab === key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
