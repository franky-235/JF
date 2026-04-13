-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES (extends Supabase Auth users)
-- ============================================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null default '',
  avatar_url text,
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view all profiles"
  on public.profiles for select using (auth.role() = 'authenticated');

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- CUSTOMERS
-- ============================================================
create table public.customers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  company text,
  email text,
  phone text,
  hubspot_id text unique,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customers enable row level security;

create policy "Authenticated users can manage customers"
  on public.customers for all using (auth.role() = 'authenticated');

-- ============================================================
-- PROJECTS
-- ============================================================
create table public.projects (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  customer_id uuid references public.customers(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects enable row level security;

create policy "Authenticated users can manage projects"
  on public.projects for all using (auth.role() = 'authenticated');

-- ============================================================
-- TASK COLUMNS (Kanban)
-- ============================================================
create table public.task_columns (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  position integer not null default 0,
  color text default '#6366f1',
  created_at timestamptz not null default now()
);

alter table public.task_columns enable row level security;

create policy "Authenticated users can manage task_columns"
  on public.task_columns for all using (auth.role() = 'authenticated');

-- ============================================================
-- TASKS
-- ============================================================
create table public.tasks (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  column_id uuid not null references public.task_columns(id) on delete cascade,
  title text not null,
  description text,
  assignee_id uuid references public.profiles(id) on delete set null,
  due_date date,
  start_date date,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  position integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tasks enable row level security;

create policy "Authenticated users can manage tasks"
  on public.tasks for all using (auth.role() = 'authenticated');

-- ============================================================
-- MESSAGES (Chat)
-- ============================================================
create table public.messages (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

create policy "Authenticated users can read messages"
  on public.messages for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert messages"
  on public.messages for insert with check (auth.uid() = user_id);

-- ============================================================
-- Enable Realtime on key tables
-- ============================================================
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.task_columns;
alter publication supabase_realtime add table public.messages;

-- ============================================================
-- Updated_at triggers
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_customers_updated_at before update on public.customers
  for each row execute procedure public.set_updated_at();
create trigger set_projects_updated_at before update on public.projects
  for each row execute procedure public.set_updated_at();
create trigger set_tasks_updated_at before update on public.tasks
  for each row execute procedure public.set_updated_at();
