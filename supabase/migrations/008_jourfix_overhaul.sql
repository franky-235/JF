-- ============================================================
-- Jourfix-Überarbeitung
--  * Sortierung, Fälligkeit und Priorität je Aufgabe
--  * Übertrag nimmt Details/Fälligkeit/Priorität mit
--  * Nachträgliches Übernehmen offener Aufgaben aus der Vorwoche
--  * Erledigt-Status wird an spätere Kopien und ans Board weitergegeben
--  * Atomare Teilnehmer-/Sortier-RPCs
-- ============================================================

alter table public.jourfix_tasks
  add column position integer not null default 0,
  add column due_date date,
  add column priority text not null default 'medium' check (priority in ('low', 'medium', 'high'));

update public.jourfix_tasks t
set position = s.rn
from (
  select id, (row_number() over (partition by week_id, area_id order by created_at) - 1)::int as rn
  from public.jourfix_tasks
) s
where s.id = t.id;

create index if not exists jourfix_tasks_week_area_position_idx
  on public.jourfix_tasks (week_id, area_id, position);
create index if not exists jourfix_tasks_origin_idx
  on public.jourfix_tasks (coalesce(origin_task_id, id));
create index if not exists jourfix_tasks_linked_idx
  on public.jourfix_tasks (linked_task_id) where linked_task_id is not null;

-- Teilnehmer-Änderungen live anzeigen
alter publication supabase_realtime add table public.jourfix_week_participants;

-- ============================================================
-- Übertrag: kopiert offene Aufgaben der Vorwoche, die in p_week_id
-- noch keine Kopie haben. Liefert die Anzahl übernommener Aufgaben.
-- ============================================================
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
     carried_over_count, origin_task_id, linked_task_id, created_by)
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
    prev.created_by
  from public.jourfix_tasks prev
  where prev.week_id = v_prev_week_id
    and prev.done = false
    and not exists (
      select 1 from public.jourfix_tasks cur
      where cur.week_id = p_week_id
        and coalesce(cur.origin_task_id, cur.id) = coalesce(prev.origin_task_id, prev.id)
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.jourfix_carry_over(uuid) to authenticated;

create or replace function public.jourfix_ensure_week(p_week_start date)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_week_id uuid;
begin
  select id into v_week_id from public.jourfix_weeks where week_start = p_week_start;
  if v_week_id is not null then
    return v_week_id;
  end if;

  insert into public.jourfix_weeks (week_start) values (p_week_start)
    on conflict (week_start) do nothing
    returning id into v_week_id;
  if v_week_id is null then
    -- parallel angelegt
    select id into v_week_id from public.jourfix_weeks where week_start = p_week_start;
    return v_week_id;
  end if;

  perform public.jourfix_carry_over(v_week_id);
  return v_week_id;
end;
$$;

-- ============================================================
-- Board-Hilfen: "Erledigt"-Spalte erkennen (gleiche Regel wie Dashboard)
-- ============================================================
create or replace function public.task_column_is_done(p_column_id uuid)
returns boolean language sql stable set search_path = public as $$
  select coalesce(
    (select lower(title) like '%erledigt%' or lower(title) like '%done%'
     from public.task_columns where id = p_column_id),
    false
  );
$$;

-- ============================================================
-- Trigger: Erledigt-Status einer Jourfix-Aufgabe
--  -> an spätere Kopien derselben Aufgabe weitergeben
--  -> verknüpfte Board-Aufgabe in Erledigt- bzw. erste offene Spalte verschieben
-- ============================================================
create or replace function public.jourfix_task_done_sync()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_week_start date;
  v_project_id uuid;
  v_column_id uuid;
  v_target_column uuid;
begin
  if new.done is not distinct from old.done then
    return new;
  end if;

  select week_start into v_week_start from public.jourfix_weeks where id = new.week_id;

  update public.jourfix_tasks t
  set done = new.done
  from public.jourfix_weeks w
  where w.id = t.week_id
    and w.week_start > v_week_start
    and coalesce(t.origin_task_id, t.id) = coalesce(new.origin_task_id, new.id)
    and t.done is distinct from new.done;

  if new.linked_task_id is not null then
    select project_id, column_id into v_project_id, v_column_id
      from public.tasks where id = new.linked_task_id;

    if v_project_id is not null and public.task_column_is_done(v_column_id) is distinct from new.done then
      select id into v_target_column
        from public.task_columns
        where project_id = v_project_id
          and public.task_column_is_done(id) = new.done
        order by position
        limit 1;

      if v_target_column is not null then
        update public.tasks set column_id = v_target_column, position = 9999
          where id = new.linked_task_id;
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger jourfix_task_done_sync
  after update of done on public.jourfix_tasks
  for each row execute procedure public.jourfix_task_done_sync();

-- ============================================================
-- Trigger: Board-Aufgabe wechselt in/aus Erledigt-Spalte
--  -> verknüpfte Jourfix-Aufgaben abhaken bzw. wieder öffnen
-- ============================================================
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

  -- Nur die jüngste Kopie ändern; ältere Wochen bleiben als Verlauf erhalten,
  -- spätere Kopien übernimmt jourfix_task_done_sync.
  update public.jourfix_tasks
    set done = v_done
    where id = (
      select t.id
      from public.jourfix_tasks t
      join public.jourfix_weeks w on w.id = t.week_id
      where t.linked_task_id = new.id
      order by w.week_start desc
      limit 1
    )
    and done is distinct from v_done;

  return new;
end;
$$;

create trigger board_task_done_sync
  after update of column_id on public.tasks
  for each row execute procedure public.board_task_done_sync();

-- ============================================================
-- Teilnehmer atomar setzen (RLS der Tabelle gilt: nur Admins)
-- ============================================================
create or replace function public.jourfix_set_participants(p_week_id uuid, p_user_ids uuid[])
returns void language plpgsql security invoker set search_path = public as $$
begin
  delete from public.jourfix_week_participants
    where week_id = p_week_id and not (user_id = any(p_user_ids));
  insert into public.jourfix_week_participants (week_id, user_id)
    select p_week_id, unnest(p_user_ids)
    on conflict do nothing;
end;
$$;

grant execute on function public.jourfix_set_participants(uuid, uuid[]) to authenticated;

-- ============================================================
-- Sortieren: Aufgabe in Bereich verschieben und Reihenfolge setzen
-- ============================================================
create or replace function public.jourfix_move_task(p_task_id uuid, p_area_id uuid, p_ordered_ids uuid[])
returns void language plpgsql security invoker set search_path = public as $$
begin
  update public.jourfix_tasks set area_id = p_area_id where id = p_task_id and area_id <> p_area_id;
  update public.jourfix_tasks t
    set position = o.idx - 1
    from unnest(p_ordered_ids) with ordinality as o(id, idx)
    where t.id = o.id and t.position <> o.idx - 1;
end;
$$;

grant execute on function public.jourfix_move_task(uuid, uuid, uuid[]) to authenticated;

-- Bereiche sortieren (RLS: nur Admins dürfen jourfix_areas ändern)
create or replace function public.jourfix_reorder_areas(p_ordered_ids uuid[])
returns void language plpgsql security invoker set search_path = public as $$
begin
  update public.jourfix_areas a
    set position = o.idx - 1
    from unnest(p_ordered_ids) with ordinality as o(id, idx)
    where a.id = o.id and a.position <> o.idx - 1;
end;
$$;

grant execute on function public.jourfix_reorder_areas(uuid[]) to authenticated;
