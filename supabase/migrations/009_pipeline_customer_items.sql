-- ============================================================
-- Kunden-Pipeline + offene Kundenpunkte + Verknüpfung mit Jourfix/Board
-- Setzt 008_jourfix_overhaul.sql voraus.
-- ============================================================

-- ------------------------------------------------------------
-- Pipeline-Phase je Kunde (jeder Kunde ist immer in einer Phase)
-- ------------------------------------------------------------
alter table public.customers
  add column pipeline_stage text not null default 'lead'
    check (pipeline_stage in ('lead', 'erstgespraech', 'angebot', 'verhandlung', 'gewonnen', 'verloren')),
  add column pipeline_position integer not null default 0,
  add column stage_changed_at timestamptz not null default now();

-- Bestandskunden mit Projekt gelten als gewonnen
update public.customers c
  set pipeline_stage = 'gewonnen'
  where exists (select 1 from public.projects p where p.customer_id = c.id);

-- updated_at pflegen (Trigger fehlte bisher für customers)
drop trigger if exists set_customers_updated_at on public.customers;
create trigger set_customers_updated_at before update on public.customers
  for each row execute procedure public.set_updated_at();

-- ------------------------------------------------------------
-- Offene Punkte je Kunde
-- ------------------------------------------------------------
create table public.customer_items (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  title text not null,
  details text,
  done boolean not null default false,
  assignee_id uuid references public.profiles(id) on delete set null,
  due_date date,
  linked_task_id uuid references public.tasks(id) on delete set null,
  position integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customer_items_customer_idx on public.customer_items (customer_id, position);
create index customer_items_linked_idx on public.customer_items (linked_task_id) where linked_task_id is not null;

alter table public.customer_items enable row level security;

create policy "Authenticated users can manage customer_items"
  on public.customer_items for all using (auth.role() = 'authenticated');

create trigger set_customer_items_updated_at before update on public.customer_items
  for each row execute procedure public.set_updated_at();

alter publication supabase_realtime add table public.customer_items;
alter publication supabase_realtime add table public.customers;

-- ------------------------------------------------------------
-- Jourfix: feste Kategorie "Kunden" + Verweis auf Kundenpunkt
-- ------------------------------------------------------------
alter table public.jourfix_areas
  add column kind text not null default 'custom' check (kind in ('custom', 'customers'));

create unique index jourfix_areas_single_customers_idx on public.jourfix_areas (kind) where kind = 'customers';

insert into public.jourfix_areas (name, position, kind)
  select 'Kunden', (select coalesce(max(position) + 1, 0) from public.jourfix_areas), 'customers'
  where not exists (select 1 from public.jourfix_areas where kind = 'customers');

create or replace function public.jourfix_protect_customers_area()
returns trigger language plpgsql as $$
begin
  if old.kind = 'customers' then
    raise exception 'Die Kategorie "Kunden" kann nicht gelöscht werden';
  end if;
  return old;
end;
$$;

create trigger jourfix_protect_customers_area
  before delete on public.jourfix_areas
  for each row execute procedure public.jourfix_protect_customers_area();

alter table public.jourfix_tasks
  add column customer_item_id uuid references public.customer_items(id) on delete set null;

create index jourfix_tasks_customer_item_idx on public.jourfix_tasks (customer_item_id) where customer_item_id is not null;

-- ------------------------------------------------------------
-- Übertrag: zusätzlich customer_item_id mitnehmen
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
     carried_over_count, origin_task_id, linked_task_id, customer_item_id, created_by)
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
    prev.created_by
  from public.jourfix_tasks prev
  where prev.week_id = v_prev_week_id
    and prev.done = false
    and not exists (
      select 1 from public.jourfix_tasks cur
      where cur.week_id = p_week_id
        and (
          coalesce(cur.origin_task_id, cur.id) = coalesce(prev.origin_task_id, prev.id)
          or (prev.customer_item_id is not null and cur.customer_item_id = prev.customer_item_id)
        )
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ------------------------------------------------------------
-- Board-Aufgabe erledigt/offen setzen (Spalte wechseln)
-- ------------------------------------------------------------
create or replace function public.board_task_set_done(p_task_id uuid, p_done boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_project_id uuid;
  v_column_id uuid;
  v_target_column uuid;
begin
  select project_id, column_id into v_project_id, v_column_id from public.tasks where id = p_task_id;
  if v_project_id is null or public.task_column_is_done(v_column_id) is not distinct from p_done then
    return;
  end if;

  select id into v_target_column
    from public.task_columns
    where project_id = v_project_id and public.task_column_is_done(id) = p_done
    order by position
    limit 1;

  if v_target_column is not null then
    update public.tasks set column_id = v_target_column, position = 9999 where id = p_task_id;
  end if;
end;
$$;

grant execute on function public.board_task_set_done(uuid, boolean) to authenticated;

-- ------------------------------------------------------------
-- Sync-Trigger (alle Updates nur bei tatsächlicher Änderung -> keine Schleifen)
-- ------------------------------------------------------------
create or replace function public.jourfix_task_done_sync()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_week_start date;
begin
  if new.done is not distinct from old.done then
    return new;
  end if;

  select week_start into v_week_start from public.jourfix_weeks where id = new.week_id;

  -- spätere Kopien derselben Aufgabe
  update public.jourfix_tasks t
  set done = new.done
  from public.jourfix_weeks w
  where w.id = t.week_id
    and w.week_start > v_week_start
    and coalesce(t.origin_task_id, t.id) = coalesce(new.origin_task_id, new.id)
    and t.done is distinct from new.done;

  if new.customer_item_id is not null then
    update public.customer_items set done = new.done
      where id = new.customer_item_id and done is distinct from new.done;
  end if;

  if new.linked_task_id is not null then
    perform public.board_task_set_done(new.linked_task_id, new.done);
  end if;

  return new;
end;
$$;

create or replace function public.customer_item_done_sync()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.done is not distinct from old.done then
    return new;
  end if;

  -- jüngste Jourfix-Kopie (ältere Wochen bleiben Verlauf)
  update public.jourfix_tasks
    set done = new.done
    where id = (
      select t.id from public.jourfix_tasks t
      join public.jourfix_weeks w on w.id = t.week_id
      where t.customer_item_id = new.id
      order by w.week_start desc
      limit 1
    )
    and done is distinct from new.done;

  if new.linked_task_id is not null then
    perform public.board_task_set_done(new.linked_task_id, new.done);
  end if;

  return new;
end;
$$;

create trigger customer_item_done_sync
  after update of done on public.customer_items
  for each row execute procedure public.customer_item_done_sync();

create or replace function public.board_task_done_sync()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_done boolean;
begin
  if new.column_id is not distinct from old.column_id then
    return new;
  end if;

  v_done := public.task_column_is_done(new.column_id);
  if v_done is not distinct from public.task_column_is_done(old.column_id) then
    return new;
  end if;

  update public.jourfix_tasks
    set done = v_done
    where id = (
      select t.id from public.jourfix_tasks t
      join public.jourfix_weeks w on w.id = t.week_id
      where t.linked_task_id = new.id
      order by w.week_start desc
      limit 1
    )
    and done is distinct from v_done;

  update public.customer_items
    set done = v_done
    where linked_task_id = new.id and done is distinct from v_done;

  return new;
end;
$$;

-- ------------------------------------------------------------
-- Kundenpunkt in den Jourfix (Kategorie "Kunden") übernehmen.
-- Ohne p_week_id: aktuelle Woche (wird bei Bedarf angelegt).
-- Idempotent je Woche. Liefert die jourfix_tasks.id.
-- ------------------------------------------------------------
create or replace function public.jourfix_add_customer_item(p_item_id uuid, p_week_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_week_id uuid;
  v_area_id uuid;
  v_task_id uuid;
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

  select id into v_area_id from public.jourfix_areas where kind = 'customers';

  insert into public.jourfix_tasks
    (week_id, area_id, title, details, assignee_id, due_date, done, position,
     linked_task_id, customer_item_id, created_by)
  values (
    v_week_id, v_area_id, v_item.title, v_item.details, v_item.assignee_id, v_item.due_date, v_item.done,
    (select coalesce(max(position) + 1, 0) from public.jourfix_tasks where week_id = v_week_id and area_id = v_area_id),
    v_item.linked_task_id, v_item.id, auth.uid()
  )
  returning id into v_task_id;

  return v_task_id;
end;
$$;

grant execute on function public.jourfix_add_customer_item(uuid, uuid) to authenticated;

-- ------------------------------------------------------------
-- Jourfix-Aufgabe oder Kundenpunkt ins Board übernehmen.
-- p_kind: 'jourfix' | 'customer_item'. Verknüpft alle zugehörigen
-- Datensätze (Jourfix-Kopien + Kundenpunkt). Liefert tasks.id.
-- ------------------------------------------------------------
create or replace function public.link_to_board(p_kind text, p_id uuid, p_column_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_project_id uuid;
  v_task_id uuid;
  v_title text;
  v_details text;
  v_assignee uuid;
  v_due date;
  v_priority text := 'medium';
  v_done boolean;
  v_existing uuid;
  v_customer_item uuid;
  v_origin uuid;
begin
  if auth.role() <> 'authenticated' then
    raise exception 'not authenticated';
  end if;

  select project_id into v_project_id from public.task_columns where id = p_column_id;
  if v_project_id is null then
    raise exception 'Spalte nicht gefunden';
  end if;

  if p_kind = 'jourfix' then
    select title, details, assignee_id, due_date, priority, done, linked_task_id, customer_item_id, coalesce(origin_task_id, id)
      into v_title, v_details, v_assignee, v_due, v_priority, v_done, v_existing, v_customer_item, v_origin
      from public.jourfix_tasks where id = p_id;
  elsif p_kind = 'customer_item' then
    select title, details, assignee_id, due_date, done, linked_task_id, id
      into v_title, v_details, v_assignee, v_due, v_done, v_existing, v_customer_item
      from public.customer_items where id = p_id;
  else
    raise exception 'Unbekannter Typ %', p_kind;
  end if;

  if v_title is null then
    raise exception 'Eintrag nicht gefunden';
  end if;
  if v_existing is not null then
    return v_existing;
  end if;

  insert into public.tasks (project_id, column_id, title, description, assignee_id, due_date, priority, position, created_by)
    values (v_project_id, p_column_id, v_title, v_details, v_assignee, v_due, v_priority, 9999, auth.uid())
    returning id into v_task_id;

  if v_origin is not null then
    update public.jourfix_tasks set linked_task_id = v_task_id
      where coalesce(origin_task_id, id) = v_origin and linked_task_id is null;
  end if;
  if v_customer_item is not null then
    update public.customer_items set linked_task_id = v_task_id
      where id = v_customer_item and linked_task_id is null;
    update public.jourfix_tasks set linked_task_id = v_task_id
      where customer_item_id = v_customer_item and linked_task_id is null;
  end if;

  if v_done then
    perform public.board_task_set_done(v_task_id, true);
  end if;

  return v_task_id;
end;
$$;

grant execute on function public.link_to_board(text, uuid, uuid) to authenticated;

-- ------------------------------------------------------------
-- Absicherung: Funktionen sind in Postgres standardmäßig für PUBLIC
-- (inkl. anon, also ohne Login) ausführbar. Nur angemeldete Nutzer zulassen.
-- ------------------------------------------------------------
revoke execute on function public.jourfix_ensure_week(date) from public, anon;
revoke execute on function public.jourfix_carry_over(uuid) from public, anon;
revoke execute on function public.jourfix_set_participants(uuid, uuid[]) from public, anon;
revoke execute on function public.jourfix_move_task(uuid, uuid, uuid[]) from public, anon;
revoke execute on function public.jourfix_reorder_areas(uuid[]) from public, anon;
revoke execute on function public.board_task_set_done(uuid, boolean) from public, anon;
revoke execute on function public.jourfix_add_customer_item(uuid, uuid) from public, anon;
revoke execute on function public.link_to_board(text, uuid, uuid) from public, anon;
