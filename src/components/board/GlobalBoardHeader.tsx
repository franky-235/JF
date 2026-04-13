"use client";

import { useRouter } from "next/navigation";
import { Filter, ChevronDown } from "lucide-react";

interface Props {
  projects: { id: string; name: string }[];
  activeProjectId?: string;
  taskCount: number;
  columnCount: number;
}

export default function GlobalBoardHeader({ projects, activeProjectId, taskCount, columnCount }: Props) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-between px-6 py-4 border-b bg-card shrink-0">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-bold">Aufgaben Board</h1>
        <button className="flex items-center gap-2 px-3 py-1.5 border rounded-lg text-sm text-muted-foreground hover:bg-accent transition-colors">
          <Filter className="w-3.5 h-3.5" />
          Spalten ({columnCount})
        </button>
      </div>

      {/* Project selector */}
      <div className="relative">
        <select
          value={activeProjectId ?? ""}
          onChange={(e) => router.push(`/board?project=${e.target.value}`)}
          className="appearance-none pl-3 pr-8 py-1.5 border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-muted-foreground" />
      </div>
    </div>
  );
}
