export type UserRole = "admin" | "member";
export type ProjectStatus = "planning" | "active" | "on-hold" | "completed" | "archived";
export type TaskPriority = "low" | "medium" | "high";

export interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: UserRole;
  created_at: string;
}

export interface Customer {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  pipeline_stage: PipelineStage;
  pipeline_position: number;
  stage_changed_at: string;
  created_at: string;
  updated_at: string;
}

export type PipelineStage = "lead" | "erstgespraech" | "angebot" | "verhandlung" | "gewonnen" | "verloren";

export interface CustomerItem {
  id: string;
  customer_id: string;
  title: string;
  details: string | null;
  done: boolean;
  assignee_id: string | null;
  due_date: string | null;
  linked_task_id: string | null;
  position: number;
  /** Haken „In JF anzeigen“ */
  show_in_jourfix: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** Wochen, in denen der Punkt im Jourfix steht */
  jourfix_tasks?: { id: string; week_id: string }[];
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  customer_id: string | null;
  status: ProjectStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  customer?: Customer;
}

export interface TaskColumn {
  id: string;
  project_id: string;
  title: string;
  position: number;
  color: string;
  created_at: string;
  tasks?: Task[];
}

export interface Task {
  id: string;
  project_id: string;
  column_id: string;
  title: string;
  description: string | null;
  assignee_id: string | null;
  due_date: string | null;
  start_date: string | null;
  priority: TaskPriority;
  position: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  assignee?: Profile;
}

export interface Message {
  id: string;
  project_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: Profile;
}

export interface JourfixArea {
  id: string;
  name: string;
  position: number;
  kind: "custom" | "customers";
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface JourfixWeek {
  id: string;
  week_start: string;
  created_at: string;
  participants?: Profile[];
}

export interface JourfixTask {
  id: string;
  week_id: string;
  area_id: string;
  /** Spalte „Thema“ (nicht genutzt in der Kategorie „Kunden“) */
  topic: string | null;
  title: string;
  details: string | null;
  assignee_id: string | null;
  due_date: string | null;
  priority: "low" | "medium" | "high";
  position: number;
  done: boolean;
  carried_over_count: number;
  origin_task_id: string | null;
  linked_task_id: string | null;
  customer_item_id: string | null;
  /** Kunde (Kategorie „Kunden“), unabhängig davon, ob ein Pipeline-Punkt verknüpft ist */
  customer_id: string | null;
  customer?: { name: string } | null;
  /** Verbindet alle Wochen-Kopien einer Aufgabe (Notizen-Verlauf) */
  thread_id: string;
  thread_created_at: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  assignee?: Profile | null;
  customer_item?: { id: string; customer_id: string; customers: { name: string } | null } | null;
  linked_task?: { id: string; title: string; project_id: string } | null;
}

export interface JourfixNote {
  id: string;
  thread_id: string;
  week_id: string | null;
  kind: "note" | "decision";
  content: string;
  author_id: string | null;
  created_at: string;
  updated_at: string;
}
