import { addDays, format, getISOWeek } from "date-fns";
import { de } from "date-fns/locale";
import type { JourfixTask } from "@/types";

export type { BoardProjectOption as ProjectOption } from "@/components/BoardLinkButton";

export const JOURFIX_TASK_SELECT =
  "*, assignee:assignee_id(*), linked_task:tasks(id, title, project_id), customer_item:customer_items(id, customer_id, customers(name)), customer:customers(name)";

/** Spaltenbreiten der Listenansicht (Kopfzeile und Zeilen teilen sie). */
export const colWidths = {
  lead: "w-36 lg:w-52",
  assignee: "w-9 lg:w-40",
  due: "w-24",
  priority: "w-20",
  board: "w-24",
};

export type OpenCustomerItem = {
  id: string;
  title: string;
  customer_id: string;
  customers: { name: string } | null;
  jourfix_tasks: { week_id: string }[];
};

export type Priority = JourfixTask["priority"];

export function parseDay(date: string) {
  return new Date(`${date}T00:00:00`);
}

export function weekNumber(weekStart: string) {
  return getISOWeek(parseDay(weekStart));
}

export function weekRange(weekStart: string) {
  const start = parseDay(weekStart);
  return `${format(start, "dd.MM.", { locale: de })}–${format(addDays(start, 4), "dd.MM.yyyy", { locale: de })}`;
}

export function weekLabel(weekStart: string) {
  return `KW ${weekNumber(weekStart)} · ${weekRange(weekStart)}`;
}

export function shiftWeek(weekStart: string, weeks: number) {
  return format(addDays(parseDay(weekStart), weeks * 7), "yyyy-MM-dd");
}

export function todayIso() {
  return format(new Date(), "yyyy-MM-dd");
}

export function isOverdue(task: Pick<JourfixTask, "due_date" | "done">) {
  return !!task.due_date && !task.done && task.due_date < todayIso();
}

export function formatDue(date: string) {
  return format(parseDay(date), "d. MMM", { locale: de });
}

export const priorityMeta: Record<Priority, { label: string; className: string; dot: string }> = {
  low: { label: "Niedrig", className: "bg-emerald-50 text-emerald-600", dot: "bg-emerald-400" },
  medium: { label: "Mittel", className: "bg-amber-50 text-amber-600", dot: "bg-amber-400" },
  high: { label: "Hoch", className: "bg-red-50 text-red-600", dot: "bg-red-500" },
};

/** Farbe nach Anzahl der Überträge: 1 grün, 2 gelb, 3 orange, ab 4 rot. */
export function carryMeta(count: number) {
  if (count <= 0) return null;
  if (count === 1) return { bar: "bg-emerald-400", badge: "bg-emerald-50 text-emerald-700" };
  if (count === 2) return { bar: "bg-yellow-400", badge: "bg-yellow-50 text-yellow-700" };
  if (count === 3) return { bar: "bg-orange-400", badge: "bg-orange-50 text-orange-700" };
  return { bar: "bg-red-500", badge: "bg-red-50 text-red-700" };
}

export function sortByPosition<T extends { position: number; created_at: string }>(list: T[]) {
  return [...list].sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
}
