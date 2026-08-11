"use client";

import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";

interface Props {
  projects: { id: string; name: string }[];
  activeProjectId?: string;
}

export default function GlobalTimelineHeader({ projects, activeProjectId }: Props) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-between px-6 py-4 border-b bg-white shrink-0">
      <h1 className="text-lg font-bold text-slate-800">Aufgaben Zeitplan</h1>

      <div className="relative">
        <select
          value={activeProjectId ?? ""}
          onChange={(e) => router.push(`/timeline?project=${e.target.value}`)}
          className="appearance-none pl-3 pr-8 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none cursor-pointer text-slate-700"
          onFocus={(e) => (e.target.style.boxShadow = "0 0 0 2px #00ffff30")}
          onBlur={(e) => (e.target.style.boxShadow = "")}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-slate-400" />
      </div>
    </div>
  );
}
