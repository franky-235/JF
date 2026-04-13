"use client";

import { useState, useMemo } from "react";
import {
  addDays, addMonths, addWeeks,
  startOfWeek, startOfMonth, endOfMonth,
  format, differenceInDays, isSameDay,
  eachDayOfInterval, isWeekend,
} from "date-fns";
import { de } from "date-fns/locale";
import type { Task, Profile } from "@/types";
import { ChevronLeft, ChevronRight, Calendar, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskWithProfile extends Task {
  profiles: Pick<Profile, "id" | "full_name"> | null;
}

interface Props {
  tasks: TaskWithProfile[];
  profiles: Pick<Profile, "id" | "full_name">[];
  projectId: string;
}

const PRIORITY_COLORS: Record<string, { bar: string; text: string; dot: string }> = {
  low:    { bar: "bg-slate-400",   text: "text-slate-700",   dot: "bg-slate-400" },
  medium: { bar: "bg-amber-400",   text: "text-amber-700",   dot: "bg-amber-400" },
  high:   { bar: "bg-rose-500",    text: "text-rose-700",    dot: "bg-rose-500"  },
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Niedrig", medium: "Mittel", high: "Hoch",
};

const DAY_WIDTH = 36;
const ROW_HEIGHT = 48;

type ViewMode = "2weeks" | "month" | "quarter";

const VIEW_OPTIONS: { key: ViewMode; label: string }[] = [
  { key: "2weeks", label: "2 Wochen" },
  { key: "month",  label: "Monat" },
  { key: "quarter", label: "Quartal" },
];

function getDays(view: ViewMode, offset: number, today: Date): Date[] {
  if (view === "2weeks") {
    const start = addWeeks(startOfWeek(today, { weekStartsOn: 1 }), offset * 2);
    return Array.from({ length: 14 }, (_, i) => addDays(start, i));
  }
  if (view === "month") {
    const base = addMonths(new Date(today.getFullYear(), today.getMonth(), 1), offset);
    return eachDayOfInterval({ start: startOfMonth(base), end: endOfMonth(base) });
  }
  // quarter: 3 months
  const base = addMonths(new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1), offset * 3);
  return eachDayOfInterval({ start: startOfMonth(base), end: endOfMonth(addMonths(base, 2)) });
}

function getPeriodLabel(view: ViewMode, days: Date[]): string {
  if (view === "2weeks") {
    return `${format(days[0], "d. MMM", { locale: de })} – ${format(days[days.length - 1], "d. MMM yyyy", { locale: de })}`;
  }
  if (view === "month") {
    return format(days[0], "MMMM yyyy", { locale: de });
  }
  const firstMonth = format(days[0], "MMM", { locale: de });
  const lastMonth  = format(days[days.length - 1], "MMM yyyy", { locale: de });
  return `${firstMonth} – ${lastMonth}`;
}

// Group days by month for the month header row
function groupByMonth(days: Date[]) {
  const groups: { label: string; count: number }[] = [];
  for (const day of days) {
    const label = format(day, "MMMM yyyy", { locale: de });
    if (groups.length && groups[groups.length - 1].label === label) {
      groups[groups.length - 1].count++;
    } else {
      groups.push({ label, count: 1 });
    }
  }
  return groups;
}

export default function TimelineView({ tasks: allTasks, profiles }: Props) {
  const [view, setView]       = useState<ViewMode>("month");
  const [offset, setOffset]   = useState(0);
  const [groupBy, setGroupBy] = useState<"none" | "assignee" | "priority">("assignee");

  const today = useMemo(() => new Date(), []);
  const days  = useMemo(() => getDays(view, offset, today), [view, offset, today]);
  const periodLabel = getPeriodLabel(view, days);
  const monthGroups = groupByMonth(days);

  const firstDay = days[0];
  const lastDay  = days[days.length - 1];

  // All tasks (show even without dates in the list, but no bar)
  const tasksWithDates = allTasks.filter((t) => t.start_date && t.due_date);
  const tasksWithoutDates = allTasks.filter((t) => !t.start_date || !t.due_date);

  // Group tasks
  const groups = useMemo(() => {
    if (groupBy === "none") return [{ label: null, tasks: tasksWithDates }];

    if (groupBy === "assignee") {
      const map = new Map<string, { label: string; tasks: TaskWithProfile[] }>();
      map.set("unassigned", { label: "Nicht zugewiesen", tasks: [] });
      for (const p of profiles) map.set(p.id, { label: p.full_name, tasks: [] });
      for (const t of tasksWithDates) {
        const key = t.assignee_id ?? "unassigned";
        if (!map.has(key)) map.set(key, { label: "Unbekannt", tasks: [] });
        map.get(key)!.tasks.push(t);
      }
      return [...map.values()].filter((g) => g.tasks.length > 0);
    }

    // by priority
    const order = ["high", "medium", "low"];
    const map = new Map<string, { label: string; tasks: TaskWithProfile[] }>(
      order.map((p) => [p, { label: PRIORITY_LABELS[p], tasks: [] }])
    );
    for (const t of tasksWithDates) map.get(t.priority)!.tasks.push(t);
    return [...map.values()].filter((g) => g.tasks.length > 0);
  }, [tasksWithDates, groupBy, profiles]);

  function barMetrics(task: TaskWithProfile) {
    const taskStart = new Date(task.start_date!);
    const taskEnd   = new Date(task.due_date!);
    const inView    = taskStart <= lastDay && taskEnd >= firstDay;
    if (!inView) return null;
    const clampedStart = taskStart < firstDay ? firstDay : taskStart;
    const clampedEnd   = taskEnd   > lastDay  ? lastDay  : taskEnd;
    const left  = differenceInDays(clampedStart, firstDay) * DAY_WIDTH;
    const width = Math.max((differenceInDays(clampedEnd, clampedStart) + 1) * DAY_WIDTH, DAY_WIDTH * 0.6);
    const truncLeft  = taskStart < firstDay;
    const truncRight = taskEnd   > lastDay;
    return { left, width, truncLeft, truncRight };
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold">Timeline</h2>
          <p className="text-sm text-muted-foreground">
            {tasksWithDates.length} von {allTasks.length} Aufgaben mit Zeitraum
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Group by */}
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as any)}
            className="text-sm border rounded-lg px-3 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="assignee">Gruppiert nach Zuständigem</option>
            <option value="priority">Gruppiert nach Priorität</option>
            <option value="none">Keine Gruppierung</option>
          </select>

          {/* View toggle */}
          <div className="flex border rounded-lg overflow-hidden">
            {VIEW_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => { setView(key); setOffset(0); }}
                className={cn("px-3 py-1.5 text-sm transition", view === key ? "bg-primary text-primary-foreground" : "hover:bg-accent")}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-1">
            <button onClick={() => setOffset(0)} className="px-3 py-1.5 text-sm border rounded-lg hover:bg-accent transition">Heute</button>
            <button onClick={() => setOffset((o) => o - 1)} className="p-1.5 border rounded-lg hover:bg-accent transition"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-sm font-medium min-w-36 text-center">{periodLabel}</span>
            <button onClick={() => setOffset((o) => o + 1)} className="p-1.5 border rounded-lg hover:bg-accent transition"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {allTasks.length === 0 && (
        <div className="text-center py-20 text-muted-foreground border rounded-xl bg-card">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium mb-1">Noch keine Aufgaben in diesem Projekt.</p>
          <p className="text-sm">Erstelle Aufgaben im Board und vergib Start- & Fälligkeitsdaten.</p>
        </div>
      )}

      {allTasks.length > 0 && (
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <div style={{ minWidth: `${240 + days.length * DAY_WIDTH}px` }}>

              {/* Month header (only if multiple months visible) */}
              {monthGroups.length > 1 && (
                <div className="flex border-b bg-muted/30">
                  <div className="w-60 shrink-0 border-r" />
                  {monthGroups.map(({ label, count }) => (
                    <div
                      key={label}
                      style={{ width: count * DAY_WIDTH }}
                      className="text-xs font-semibold text-center py-1.5 border-r text-muted-foreground uppercase tracking-wide shrink-0"
                    >
                      {label}
                    </div>
                  ))}
                </div>
              )}

              {/* Day header */}
              <div className="flex border-b sticky top-0 bg-card z-10 shadow-sm">
                <div className="w-60 shrink-0 px-4 py-2.5 text-xs font-semibold text-muted-foreground border-r uppercase tracking-wide">
                  Aufgabe
                </div>
                {days.map((day) => {
                  const isToday   = isSameDay(day, today);
                  const isWeekend_ = isWeekend(day);
                  return (
                    <div
                      key={day.toISOString()}
                      style={{ width: DAY_WIDTH }}
                      className={cn(
                        "text-center py-2 border-r shrink-0",
                        isToday    ? "bg-primary/10" : "",
                        isWeekend_ ? "bg-muted/40"   : "",
                      )}
                    >
                      <div className="text-[10px] text-muted-foreground font-medium">
                        {format(day, "EEE", { locale: de })}
                      </div>
                      <div className={cn("text-xs font-bold", isToday ? "text-primary" : "text-foreground")}>
                        {format(day, "d")}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Groups & Task rows */}
              {groups.map(({ label, tasks }) => (
                <div key={label ?? "all"}>
                  {/* Group header */}
                  {label !== null && (
                    <div className="flex items-center border-b bg-muted/20">
                      <div className="w-60 shrink-0 px-4 py-2 border-r flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide truncate">
                          {label}
                        </span>
                        <span className="ml-auto text-xs text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 shrink-0">
                          {tasks.length}
                        </span>
                      </div>
                      <div style={{ width: days.length * DAY_WIDTH }} className="h-full">
                        {days.map((day) => (
                          <span
                            key={day.toISOString()}
                            style={{ width: DAY_WIDTH, display: "inline-block" }}
                            className={cn(
                              "h-full border-r",
                              isSameDay(day, today) ? "bg-primary/5" : "",
                              isWeekend(day) ? "bg-muted/30" : "",
                            )}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Task rows */}
                  {tasks.map((task) => {
                    const bar    = barMetrics(task);
                    const colors = PRIORITY_COLORS[task.priority];
                    return (
                      <div key={task.id} className="flex border-b hover:bg-accent/20 transition-colors group" style={{ height: ROW_HEIGHT }}>
                        {/* Label cell */}
                        <div className="w-60 shrink-0 px-4 flex items-center gap-2 border-r">
                          <span className={cn("w-2 h-2 rounded-full shrink-0", colors.dot)} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate leading-tight">{task.title}</p>
                            {task.start_date && task.due_date && (
                              <p className="text-[11px] text-muted-foreground">
                                {format(new Date(task.start_date), "dd.MM")} – {format(new Date(task.due_date), "dd.MM.yy")}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Bar area */}
                        <div className="relative flex" style={{ width: days.length * DAY_WIDTH }}>
                          {/* Grid columns */}
                          {days.map((day) => (
                            <div
                              key={day.toISOString()}
                              style={{ width: DAY_WIDTH }}
                              className={cn(
                                "h-full border-r shrink-0",
                                isSameDay(day, today) ? "bg-primary/5" : "",
                                isWeekend(day) ? "bg-muted/20" : "",
                              )}
                            />
                          ))}

                          {/* Gantt bar */}
                          {bar && (
                            <div
                              className={cn(
                                "absolute top-3 bottom-3 flex items-center px-2.5 shadow-sm",
                                colors.bar,
                                bar.truncLeft  ? "rounded-r-full" : "",
                                bar.truncRight ? "rounded-l-full" : "",
                                !bar.truncLeft && !bar.truncRight ? "rounded-full" : "",
                              )}
                              style={{ left: bar.left, width: bar.width }}
                              title={`${format(new Date(task.start_date!), "dd.MM.yyyy")} – ${format(new Date(task.due_date!), "dd.MM.yyyy")}`}
                            >
                              <span className="text-white text-xs font-medium truncate leading-none">
                                {task.title}
                              </span>
                            </div>
                          )}

                          {/* No-date badge */}
                          {!task.start_date || !task.due_date ? (
                            <div className="absolute inset-0 flex items-center px-3">
                              <span className="text-xs text-muted-foreground italic">Kein Datum gesetzt</span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* Tasks without dates (if any) */}
              {tasksWithoutDates.length > 0 && (
                <div>
                  <div className="flex items-center border-b bg-muted/20">
                    <div className="w-60 shrink-0 px-4 py-2 border-r">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Ohne Datum ({tasksWithoutDates.length})
                      </span>
                    </div>
                    <div style={{ width: days.length * DAY_WIDTH }} />
                  </div>
                  {tasksWithoutDates.map((task) => (
                    <div key={task.id} className="flex border-b hover:bg-accent/20 transition-colors" style={{ height: ROW_HEIGHT }}>
                      <div className="w-60 shrink-0 px-4 flex items-center gap-2 border-r opacity-50">
                        <span className={cn("w-2 h-2 rounded-full shrink-0", PRIORITY_COLORS[task.priority].dot)} />
                        <p className="text-sm truncate">{task.title}</p>
                      </div>
                      <div className="flex items-center px-4 text-xs text-muted-foreground italic" style={{ width: days.length * DAY_WIDTH }}>
                        Kein Start- oder Fälligkeitsdatum
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer: Legend */}
          <div className="flex items-center gap-5 px-4 py-3 border-t bg-muted/20 text-xs text-muted-foreground flex-wrap">
            <span className="font-semibold">Priorität:</span>
            {Object.entries(PRIORITY_LABELS).map(([key, label]) => (
              <span key={key} className="flex items-center gap-1.5">
                <span className={cn("w-2.5 h-2.5 rounded-full", PRIORITY_COLORS[key].dot)} />
                {label}
              </span>
            ))}
            <span className="ml-auto flex items-center gap-1.5">
              <span className="w-5 h-3 bg-muted-foreground/20 rounded-sm" /> Wochenende
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
