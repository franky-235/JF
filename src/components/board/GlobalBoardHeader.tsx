"use client";

import { useRouter } from "next/navigation";
import { Filter, ChevronDown, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface Props {
  projects: { id: string; name: string }[];
  activeProjectId?: string;
  taskCount: number;
  columnCount: number;
  activePriority?: string;
}

const priorities = [
  { value: "high", label: "Hoch", color: "bg-red-100 text-red-700" },
  { value: "medium", label: "Mittel", color: "bg-amber-100 text-amber-700" },
  { value: "low", label: "Niedrig", color: "bg-green-100 text-green-700" },
];

export default function GlobalBoardHeader({ projects, activeProjectId, taskCount, columnCount, activePriority }: Props) {
  const router = useRouter();
  const [showFilter, setShowFilter] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowFilter(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function navigate(priority?: string) {
    const params = new URLSearchParams();
    if (activeProjectId) params.set("project", activeProjectId);
    if (priority) params.set("priority", priority);
    router.push(`/board?${params.toString()}`);
    setShowFilter(false);
  }

  const activeLabel = priorities.find((p) => p.value === activePriority)?.label;

  return (
    <div className="flex items-center justify-between px-6 py-4 border-b bg-white shrink-0">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold text-slate-800">Aufgaben Board</h1>

        {/* Filter dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowFilter((v) => !v)}
            className="flex items-center gap-2 px-3 py-1.5 border rounded-lg text-sm transition-colors"
            style={activePriority
              ? { borderColor: "#00ffff", color: "#007777", backgroundColor: "#00ffff10" }
              : { color: "#64748b" }}
          >
            <Filter className="w-3.5 h-3.5" />
            {activeLabel ? `Priorität: ${activeLabel}` : `Filter`}
            <ChevronDown className="w-3 h-3" />
          </button>

          {showFilter && (
            <div className="absolute top-full left-0 mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg z-50 py-1 overflow-hidden">
              <div className="px-3 py-1.5 text-xs text-slate-400 font-medium">Priorität</div>
              {priorities.map((p) => (
                <button
                  key={p.value}
                  onClick={() => navigate(activePriority === p.value ? undefined : p.value)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-slate-50 transition-colors ${
                    activePriority === p.value ? "bg-slate-50" : ""
                  }`}
                >
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.color}`}>{p.label}</span>
                  {activePriority === p.value && <span className="ml-auto text-xs text-slate-400">✓</span>}
                </button>
              ))}
              {activePriority && (
                <>
                  <div className="border-t my-1" />
                  <button
                    onClick={() => navigate(undefined)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-slate-50 transition-colors text-slate-400"
                  >
                    <X className="w-3.5 h-3.5" />
                    Filter zurücksetzen
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {activePriority && (
          <span className="text-xs text-slate-400">{taskCount} Aufgabe{taskCount !== 1 ? "n" : ""}</span>
        )}
      </div>

      {/* Project selector */}
      <div className="relative">
        <select
          value={activeProjectId ?? ""}
          onChange={(e) => {
            const params = new URLSearchParams();
            params.set("project", e.target.value);
            if (activePriority) params.set("priority", activePriority);
            router.push(`/board?${params.toString()}`);
          }}
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
