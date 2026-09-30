"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Loader2, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { JourfixWeek } from "@/types";
import { weekNumber, weekRange } from "./utils";

interface Props {
  weeks: JourfixWeek[];
  currentWeekStart: string;
  selectedWeekStart: string;
  isAdmin: boolean;
  onSelect: (weekStart: string) => void;
  onOpenNewWeek: () => void;
  onDeleteWeek: (week: JourfixWeek) => void;
  creatingWeek: boolean;
}

/** Wochen-Navigation: Vor/Zurück zwischen angelegten Wochen, Auswahlliste, Anlegen/Löschen. */
export default function WeekTabs({
  weeks,
  currentWeekStart,
  selectedWeekStart,
  isAdmin,
  onSelect,
  onOpenNewWeek,
  onDeleteWeek,
  creatingWeek,
}: Props) {
  const sorted = [...weeks].sort((a, b) => b.week_start.localeCompare(a.week_start));
  const selected = sorted.find((w) => w.week_start === selectedWeekStart) ?? null;
  const older = sorted.find((w) => w.week_start < selectedWeekStart);
  const newer = [...sorted].reverse().find((w) => w.week_start > selectedWeekStart);
  const isCurrent = selectedWeekStart === currentWeekStart;

  const navBtn =
    "p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-30 disabled:hover:bg-transparent";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded-xl p-1">
        <button onClick={() => older && onSelect(older.week_start)} disabled={!older} className={navBtn} aria-label="Vorherige Woche">
          <ChevronLeft className="w-4 h-4" />
        </button>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="flex items-center gap-2 px-2.5 py-1 rounded-lg hover:bg-slate-50 min-w-[190px] justify-between">
              <span className="flex items-baseline gap-2">
                <span className="text-sm font-semibold text-slate-800">KW {weekNumber(selectedWeekStart)}</span>
                <span className="text-xs text-slate-500 tabular-nums">{weekRange(selectedWeekStart)}</span>
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="start"
              sideOffset={6}
              className="z-50 w-64 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
            >
              {sorted.map((w) => (
                <DropdownMenu.Item
                  key={w.id}
                  onSelect={() => onSelect(w.week_start)}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm text-slate-700 outline-none cursor-pointer data-[highlighted]:bg-slate-50"
                >
                  <span className="font-medium w-12">KW {weekNumber(w.week_start)}</span>
                  <span className="text-xs text-slate-500 tabular-nums flex-1">{weekRange(w.week_start)}</span>
                  {w.week_start === currentWeekStart && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-50 text-cyan-700 font-medium">aktuell</span>
                  )}
                  {w.week_start === selectedWeekStart && <Check className="w-3.5 h-3.5 text-cyan-600" />}
                </DropdownMenu.Item>
              ))}
              {sorted.length === 0 && <p className="px-2.5 py-2 text-sm text-slate-400">Noch keine Wochen angelegt</p>}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        <button onClick={() => newer && onSelect(newer.week_start)} disabled={!newer} className={navBtn} aria-label="Nächste Woche">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {isCurrent ? (
        <span className="text-xs px-2 py-1 rounded-full bg-cyan-50 text-cyan-700 font-medium">Aktuelle Woche</span>
      ) : (
        <button
          onClick={() => onSelect(currentWeekStart)}
          className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
        >
          Zur aktuellen Woche
        </button>
      )}

      <div className="ml-auto flex items-center gap-1.5">
        {isAdmin && selected && (
          <button
            onClick={() => onDeleteWeek(selected)}
            className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
            title="Diese Woche löschen"
            aria-label="Diese Woche löschen"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={onOpenNewWeek}
          disabled={creatingWeek}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold",
            "bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
          )}
        >
          {creatingWeek ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Neue Woche
        </button>
      </div>
    </div>
  );
}
