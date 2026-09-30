-- ============================================================
-- Fix: Projekt-Farbe. Der Code (Projekte anlegen/bearbeiten, Sidebar)
-- nutzt projects.color, die Spalte wurde aber nie angelegt
-- ("Could not find the 'color' column of 'projects' in the schema cache").
-- ============================================================

alter table public.projects add column if not exists color text not null default '#6366f1';

-- Das Formular bietet zusätzlich "Planung" und "Pausiert" an, die DB erlaubte nur
-- active/completed/archived -> Speichern mit diesen Status schlug fehl.
alter table public.projects drop constraint if exists projects_status_check;
alter table public.projects add constraint projects_status_check
  check (status in ('planning', 'active', 'on-hold', 'completed', 'archived'));

-- PostgREST-Schema-Cache sofort neu laden
notify pgrst, 'reload schema';
