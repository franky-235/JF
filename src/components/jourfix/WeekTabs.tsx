"use client";

import { format, getISOWeek, addDays } from "date-fns";
import { de } from "date-fns/locale";
import { Plus, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { JourfixWeek } from "@/types";

interface Props {
  weeks: JourfixWeek[];
  currentWeekStart: string;
  selectedWeekStart: string;
  isAdmin: boolean;
  onSelect: (weekStart: string) => void;
  onOpenNewWeek: () => void;
  onDeleteWeek: (weekId: string) => void;
  creatingWeek: boolean;
}

function weekLabel(weekStart: string) {
  const start = new Date(`${weekStart}T00:00:00`);
  const end = addDays(start, 4);
  return `KW ${getISOWeek(start)} · ${format(start, "dd.MM.", { locale: de })}–${format(end, "dd.MM.yyyy", { locale: de })}`;
}

export default function WeekTabs({ weeks, currentWeekStart, selectedWeekStart, isAdmin, onSelect, onOpenNewWeek, onDeleteWeek, creatingWeek }: Props) {
  const sorted = [...weeks].sort((a, b) => b.week_start.localeCompare(a.week_start));
  const hasSelected = sorted.some((w) => w.week_start === selectedWeekStart);

  return (
    <div className="flex items-center gap-1.5 px-6 py-2.5 border-b overflow-x-auto">
      {sorted.map((w) => {
        const isSelected = w.week_start === selectedWeekStart;
        const isCurrent = w.week_start === currentWeekStart;
        return (
          <div
            key={w.id}
            className={cn(
              "shrink-0 flex items-center gap-1 pl-3 pr-1.5 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors",
              isSelected ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <button onClick={() => onSelect(w.week_start)} className="whitespace-nowrap">
              {weekLabel(w.week_start)}
              {isCurrent && <span className="ml-1.5 text-xs opacity-70">· aktuell</span>}
            </button>
            {isAdmin && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Zeitraum ${weekLabel(w.week_start)} wirklich löschen? Alle Aufgaben dieser Woche werden entfernt.`)) {
                    onDeleteWeek(w.id);
                  }
                }}
                title="Zeitraum löschen"
                className={cn(
                  "p-0.5 rounded-md transition-colors",
                  isSelected ? "hover:bg-black/10" : "hover:bg-destructive/10 hover:text-destructive"
                )}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        );
      })}
      {!hasSelected && (
        <button className="shrink-0 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap bg-primary text-primary-foreground font-medium">
          {weekLabel(selectedWeekStart)}
        </button>
      )}
      <button
        onClick={onOpenNewWeek}
        disabled={creatingWeek}
        title="Nächste Woche anlegen"
        className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
      >
        {creatingWeek ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
      </button>
    </div>
  );
}
