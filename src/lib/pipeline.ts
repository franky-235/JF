import type { PipelineStage } from "@/types";

export const pipelineStages: { id: PipelineStage; label: string; color: string; badge: string }[] = [
  { id: "lead", label: "Lead", color: "#94a3b8", badge: "bg-slate-100 text-slate-700" },
  { id: "erstgespraech", label: "Erstgespräch", color: "#22d3ee", badge: "bg-cyan-50 text-cyan-700" },
  { id: "angebot", label: "Angebot", color: "#6366f1", badge: "bg-indigo-50 text-indigo-700" },
  { id: "verhandlung", label: "Verhandlung", color: "#f59e0b", badge: "bg-amber-50 text-amber-700" },
  { id: "gewonnen", label: "Gewonnen", color: "#10b981", badge: "bg-emerald-50 text-emerald-700" },
  { id: "verloren", label: "Verloren", color: "#ef4444", badge: "bg-red-50 text-red-700" },
];

export const stageMeta = Object.fromEntries(pipelineStages.map((s) => [s.id, s])) as Record<
  PipelineStage,
  (typeof pipelineStages)[number]
>;
