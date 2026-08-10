-- ============================================================
-- JOURFIX AREAS (Aufgabenbereiche, global, nicht wochengebunden)
-- ============================================================
create table public.jourfix_areas (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  position integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.jourfix_areas enable row level security;

create policy "Authenticated users can view jourfix_areas"
  on public.jourfix_areas for select using (auth.role() = 'authenticated');

create policy "Admins can insert jourfix_areas"
  on public.jourfix_areas for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Admins can update jourfix_areas"
  on public.jourfix_areas for update
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- ============================================================
-- JOURFIX WEEKS (wöchentliche Reiter)
-- ============================================================
create table public.jourfix_weeks (
  id uuid primary key default uuid_generate_v4(),
  week_start date not null unique,
  created_at timestamptz not null default now()
);

alter table public.jourfix_weeks enable row level security;

create policy "Authenticated users can view jourfix_weeks"
  on public.jourfix_weeks for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert jourfix_weeks"
  on public.jourfix_weeks for insert with check (auth.role() = 'authenticated');

-- ============================================================
-- JOURFIX TASKS
-- ============================================================
create table public.jourfix_tasks (
  id uuid primary key default uuid_generate_v4(),
  week_id uuid not null references public.jourfix_weeks(id) on delete cascade,
  area_id uuid not null references public.jourfix_areas(id) on delete cascade,
  title text not null,
  assignee_id uuid references public.profiles(id) on delete set null,
  done boolean not null default false,
  carried_over_count integer not null default 0,
  origin_task_id uuid references public.jourfix_tasks(id) on delete set null,
  linked_task_id uuid references public.tasks(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.jourfix_tasks enable row level security;

create policy "Authenticated users can manage jourfix_tasks"
  on public.jourfix_tasks for all using (auth.role() = 'authenticated');

-- ============================================================
-- Updated_at triggers (nutzt bestehende public.set_updated_at())
-- ============================================================
create trigger set_jourfix_areas_updated_at before update on public.jourfix_areas
  for each row execute procedure public.set_updated_at();
create trigger set_jourfix_tasks_updated_at before update on public.jourfix_tasks
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- Realtime
-- ============================================================
alter publication supabase_realtime add table public.jourfix_tasks;
alter publication supabase_realtime add table public.jourfix_areas;

-- ============================================================
-- Rollover: legt eine Woche an (falls nicht vorhanden) und übernimmt
-- offene Aufgaben der Vorwoche mit erhöhtem carried_over_count.
-- Idempotent über den unique-Constraint auf week_start.
-- ============================================================
create or replace function public.jourfix_ensure_week(p_week_start date)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_week_id uuid;
  v_prev_week_id uuid;
begin
  select id into v_week_id from public.jourfix_weeks where week_start = p_week_start;
  if v_week_id is not null then
    return v_week_id;
  end if;

  insert into public.jourfix_weeks (week_start) values (p_week_start)
    returning id into v_week_id;

  select id into v_prev_week_id from public.jourfix_weeks
    where week_start < p_week_start
    order by week_start desc
    limit 1;

  if v_prev_week_id is not null then
    insert into public.jourfix_tasks
      (week_id, area_id, title, assignee_id, carried_over_count, origin_task_id, linked_task_id, created_by)
    select
      v_week_id,
      area_id,
      title,
      assignee_id,
      carried_over_count + 1,
      coalesce(origin_task_id, id),
      linked_task_id,
      created_by
    from public.jourfix_tasks
    where week_id = v_prev_week_id and done = false;
  end if;

  return v_week_id;
end;
$$;

grant execute on function public.jourfix_ensure_week(date) to authenticated;
