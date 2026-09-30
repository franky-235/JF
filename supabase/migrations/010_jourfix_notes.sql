-- ============================================================
-- Notizen-Verlauf für Jourfix-Aufgaben
--  * thread_id verbindet alle Wochen-Kopien einer Aufgabe dauerhaft
--    (bleibt auch erhalten, wenn die Ursprungswoche gelöscht wird)
--  * jourfix_notes: datierte Einträge (Notiz / Beschluss) je Thread
--  * bestehende "details" werden als erste Notiz übernommen
-- Setzt 008 und 009 voraus.
-- ============================================================

alter table public.jourfix_tasks
  add column thread_id uuid,
  add column thread_created_at timestamptz;

update public.jourfix_tasks t
set thread_id = coalesce(t.origin_task_id, t.id),
    thread_created_at = coalesce(
      (select o.created_at from public.jourfix_tasks o where o.id = t.origin_task_id),
      t.created_at
    );

-- Kundenpunkte, die in mehreren Wochen einzeln übernommen wurden, zu einem Thread zusammenfassen
update public.jourfix_tasks t
set thread_id = s.thread_id,
    thread_created_at = s.thread_created_at
from (
  select distinct on (customer_item_id) customer_item_id, thread_id, thread_created_at
  from public.jourfix_tasks
  where customer_item_id is not null
  order by customer_item_id, thread_created_at
) s
where t.customer_item_id = s.customer_item_id
  and t.thread_id is distinct from s.thread_id;

alter table public.jourfix_tasks
  alter column thread_id set default uuid_generate_v4(),
  alter column thread_id set not null,
  alter column thread_created_at set default now(),
  alter column thread_created_at set not null;

create index jourfix_tasks_thread_idx on public.jourfix_tasks (thread_id);

-- ------------------------------------------------------------
-- Notizen
-- ------------------------------------------------------------
create table public.jourfix_notes (
  id uuid primary key default uuid_generate_v4(),
  thread_id uuid not null,
  week_id uuid references public.jourfix_weeks(id) on delete set null,
  kind text not null default 'note' check (kind in ('note', 'decision')),
  content text not null check (length(trim(content)) > 0),
  author_id uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index jourfix_notes_thread_idx on public.jourfix_notes (thread_id, created_at);

alter table public.jourfix_notes enable row level security;

create policy "Authenticated users can view jourfix_notes"
  on public.jourfix_notes for select using (auth.role() = 'authenticated');

create policy "Authenticated users can add jourfix_notes"
  on public.jourfix_notes for insert with check (auth.role() = 'authenticated' and author_id = auth.uid());

create policy "Authors and admins can update jourfix_notes"
  on public.jourfix_notes for update using (
    author_id = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Authors and admins can delete jourfix_notes"
  on public.jourfix_notes for delete using (
    author_id = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create trigger set_jourfix_notes_updated_at before update on public.jourfix_notes
  for each row execute procedure public.set_updated_at();

alter publication supabase_realtime add table public.jourfix_notes;

-- Bestehende Details als erste Notiz übernehmen (jüngster Stand je Thread)
insert into public.jourfix_notes (thread_id, week_id, kind, content, author_id, created_at, updated_at)
select distinct on (t.thread_id)
  t.thread_id, t.week_id, 'note', t.details, t.created_by, t.thread_created_at, t.updated_at
from public.jourfix_tasks t
join public.jourfix_weeks w on w.id = t.week_id
where t.details is not null and length(trim(t.details)) > 0
order by t.thread_id, w.week_start desc;

-- ------------------------------------------------------------
-- Übertrag und Kundenpunkt-Übernahme: Thread mitnehmen
-- ------------------------------------------------------------
create or replace function public.jourfix_carry_over(p_week_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_week_start date;
  v_prev_week_id uuid;
  v_count integer;
begin
  select week_start into v_week_start from public.jourfix_weeks where id = p_week_id;
  if v_week_start is null then
    return 0;
  end if;

  select id into v_prev_week_id from public.jourfix_weeks
    where week_start < v_week_start
    order by week_start desc
    limit 1;
  if v_prev_week_id is null then
    return 0;
  end if;

  insert into public.jourfix_tasks
    (week_id, area_id, title, details, assignee_id, due_date, priority, position,
     carried_over_count, origin_task_id, linked_task_id, customer_item_id, created_by,
     thread_id, thread_created_at)
  select
    p_week_id,
    prev.area_id,
    prev.title,
    prev.details,
    prev.assignee_id,
    prev.due_date,
    prev.priority,
    prev.position,
    prev.carried_over_count + 1,
    coalesce(prev.origin_task_id, prev.id),
    prev.linked_task_id,
    prev.customer_item_id,
    prev.created_by,
    prev.thread_id,
    prev.thread_created_at
  from public.jourfix_tasks prev
  where prev.week_id = v_prev_week_id
    and prev.done = false
    and not exists (
      select 1 from public.jourfix_tasks cur
      where cur.week_id = p_week_id
        and (
          cur.thread_id = prev.thread_id
          or (prev.customer_item_id is not null and cur.customer_item_id = prev.customer_item_id)
        )
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.jourfix_add_customer_item(p_item_id uuid, p_week_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_week_id uuid;
  v_area_id uuid;
  v_task_id uuid;
  v_thread_id uuid;
  v_thread_created_at timestamptz;
  v_item public.customer_items%rowtype;
begin
  if auth.role() <> 'authenticated' then
    raise exception 'not authenticated';
  end if;

  select * into v_item from public.customer_items where id = p_item_id;
  if v_item.id is null then
    raise exception 'Kundenpunkt nicht gefunden';
  end if;

  v_week_id := coalesce(p_week_id, public.jourfix_ensure_week(date_trunc('week', current_date)::date));

  select id into v_task_id from public.jourfix_tasks
    where week_id = v_week_id and customer_item_id = p_item_id;
  if v_task_id is not null then
    return v_task_id;
  end if;

  -- Bestehenden Notizen-Verlauf des Kundenpunkts weiterführen
  select thread_id, thread_created_at into v_thread_id, v_thread_created_at
    from public.jourfix_tasks
    where customer_item_id = p_item_id
    order by thread_created_at
    limit 1;

  select id into v_area_id from public.jourfix_areas where kind = 'customers';

  insert into public.jourfix_tasks
    (week_id, area_id, title, details, assignee_id, due_date, done, position,
     linked_task_id, customer_item_id, created_by, thread_id, thread_created_at)
  values (
    v_week_id, v_area_id, v_item.title, v_item.details, v_item.assignee_id, v_item.due_date, v_item.done,
    (select coalesce(max(position) + 1, 0) from public.jourfix_tasks where week_id = v_week_id and area_id = v_area_id),
    v_item.linked_task_id, v_item.id, auth.uid(),
    coalesce(v_thread_id, uuid_generate_v4()),
    coalesce(v_thread_created_at, now())
  )
  returning id into v_task_id;

  return v_task_id;
end;
$$;

-- create or replace behält bestehende Rechte; zur Sicherheit erneut setzen
revoke execute on function public.jourfix_carry_over(uuid) from public, anon;
revoke execute on function public.jourfix_add_customer_item(uuid, uuid) from public, anon;
grant execute on function public.jourfix_carry_over(uuid) to authenticated;
grant execute on function public.jourfix_add_customer_item(uuid, uuid) to authenticated;
