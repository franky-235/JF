"use client";

import { format, getISOWeek, addDays } from "date-fns";
import { de } from "date-fns/locale";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { JourfixWeek } from "@/types";

interface Props {
  weeks: JourfixWeek[];
  currentWeekStart: string;
  selectedWeekStart: string;
  onSelect: (weekStart: string) => void;
  onEnsureNextWeek: () => void;
  creatingWeek: boolean;
}

function weekLabel(weekStart: string) {
  const start = new Date(`${weekStart}T00:00:00`);
  const end = addDays(start, 4);
  return `KW ${getISOWeek(start)} · ${format(start, "dd.MM.", { locale: de })}–${format(end, "dd.MM.", { locale: de })}`;
}

export default function WeekTabs({ weeks, currentWeekStart, selectedWeekStart, onSelect, onEnsureNextWeek, creatingWeek }: Props) {
  const sorted = [...weeks].sort((a, b) => a.week_start.localeCompare(b.week_start));
  const hasSelected = sorted.some((w) => w.week_start === selectedWeekStart);

  return (
    <div className="flex items-center gap-1.5 px-6 py-2.5 border-b overflow-x-auto">
      {sorted.map((w) => {
        const isSelected = w.week_start === selectedWeekStart;
        const isCurrent = w.week_start === currentWeekStart;
        return (
          <button
            key={w.id}
            onClick={() => onSelect(w.week_start)}
            className={cn(
              "shrink-0 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors",
              isSelected ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            {weekLabel(w.week_start)}
            {isCurrent && <span className="ml-1.5 text-xs opacity-70">· aktuell</span>}
          </button>
        );
      })}
      {!hasSelected && (
        <button className="shrink-0 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap bg-primary text-primary-foreground font-medium">
          {weekLabel(selectedWeekStart)}
        </button>
      )}
      <button
        onClick={onEnsureNextWeek}
        disabled={creatingWeek}
        title="Nächste Woche anlegen"
        className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}
