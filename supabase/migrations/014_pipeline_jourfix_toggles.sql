-- ============================================================
-- Pipeline <-> Jourfix per Haken verknüpfen
--  * customer_items.show_in_jourfix ("In JF anzeigen"): Punkt steht automatisch
--    im Kundenbereich der aktuellen (und bereits angelegten späteren) Wochen
--  * jourfix_tasks.customer_id: Kundenaufgaben im Jourfix brauchen keinen
--    Pipeline-Punkt mehr; "In Pipeline bearbeiten" = verknüpfter Kundenpunkt
-- Setzt 013 voraus.
-- ============================================================

alter table public.customer_items
  add column show_in_jourfix boolean not null default false;

alter table public.jourfix_tasks
  add column customer_id uuid references public.customers(id) on delete set null;

create index jourfix_tasks_customer_idx on public.jourfix_tasks (customer_id) where customer_id is not null;

-- Bestand: Kunde aus dem verknüpften Punkt übernehmen
update public.jourfix_tasks t
  set customer_id = ci.customer_id
  from public.customer_items ci
  where ci.id = t.customer_item_id and t.customer_id is null;

-- Bestand: Punkte, die in der aktuellen oder einer späteren Woche stehen, gelten als "In JF anzeigen"
update public.customer_items ci
  set show_in_jourfix = true
  where exists (
    select 1 from public.jourfix_tasks t
    join public.jourfix_weeks w on w.id = t.week_id
    where t.customer_item_id = ci.id
      and w.week_start >= date_trunc('week', current_date)::date
  );

-- ------------------------------------------------------------
-- Interne Funktion: Kundenpunkt in eine Woche einsortieren (idempotent).
-- Nicht direkt aufrufbar; genutzt von RPC und Triggern.
-- ------------------------------------------------------------
create or replace function public.jourfix_place_customer_item(p_item_id uuid, p_week_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_area_id uuid;
  v_task_id uuid;
  v_thread_id uuid;
  v_thread_created_at timestamptz;
  v_item public.customer_items%rowtype;
begin
  select * into v_item from public.customer_items where id = p_item_id;
  if v_item.id is null then
    raise exception 'Kundenpunkt nicht gefunden';
  end if;

  select id into v_task_id from public.jourfix_tasks
    where week_id = p_week_id and customer_item_id = p_item_id;
  if v_task_id is not null then
    return v_task_id;
  end if;

  select thread_id, thread_created_at into v_thread_id, v_thread_created_at
    from public.jourfix_tasks
    where customer_item_id = p_item_id
    order by thread_created_at
    limit 1;

  select id into v_area_id from public.jourfix_areas where kind = 'customers';

  insert into public.jourfix_tasks
    (week_id, area_id, title, details, assignee_id, due_date, done, position,
     linked_task_id, customer_item_id, customer_id, created_by, thread_id, thread_created_at)
  values (
    p_week_id, v_area_id, v_item.title, v_item.details, v_item.assignee_id, v_item.due_date, v_item.done,
    (select coalesce(max(position) + 1, 0) from public.jourfix_tasks where week_id = p_week_id and area_id = v_area_id),
    v_item.linked_task_id, v_item.id, v_item.customer_id, coalesce(auth.uid(), v_item.created_by),
    coalesce(v_thread_id, gen_random_uuid()),
    coalesce(v_thread_created_at, now())
  )
  returning id into v_task_id;

  return v_task_id;
end;
$$;

revoke execute on function public.jourfix_place_customer_item(uuid, uuid) from public, anon, authenticated;

-- RPC bleibt für die bestehende Oberfläche erhalten
create or replace function public.jourfix_add_customer_item(p_item_id uuid, p_week_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  if auth.role() <> 'authenticated' then
    raise exception 'not authenticated';
  end if;
  return public.jourfix_place_customer_item(
    p_item_id,
    coalesce(p_week_id, public.jourfix_ensure_week(date_trunc('week', current_date)::date))
  );
end;
$$;

revoke execute on function public.jourfix_add_customer_item(uuid, uuid) from public, anon;
grant execute on function public.jourfix_add_customer_item(uuid, uuid) to authenticated;

-- ------------------------------------------------------------
-- Übertrag: Kunde mitnehmen
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
    (week_id, area_id, topic, title, details, assignee_id, due_date, priority, position,
     carried_over_count, origin_task_id, linked_task_id, customer_item_id, customer_id, created_by,
     thread_id, thread_created_at)
  select
    p_week_id, prev.area_id, prev.topic, prev.title, prev.details, prev.assignee_id, prev.due_date,
    prev.priority, prev.position, prev.carried_over_count + 1, coalesce(prev.origin_task_id, prev.id),
    prev.linked_task_id, prev.customer_item_id, prev.customer_id, prev.created_by,
    prev.thread_id, prev.thread_created_at
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

revoke execute on function public.jourfix_carry_over(uuid) from public, anon;
grant execute on function public.jourfix_carry_over(uuid) to authenticated;

-- ------------------------------------------------------------
-- Neue Woche: Übertrag + alle offenen "In JF anzeigen"-Punkte einsortieren
-- ------------------------------------------------------------
create or replace function public.jourfix_ensure_week(p_week_start date)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_week_id uuid;
  v_item_id uuid;
begin
  select id into v_week_id from public.jourfix_weeks where week_start = p_week_start;
  if v_week_id is not null then
    return v_week_id;
  end if;

  insert into public.jourfix_weeks (week_start) values (p_week_start)
    on conflict (week_start) do nothing
    returning id into v_week_id;
  if v_week_id is null then
    select id into v_week_id from public.jourfix_weeks where week_start = p_week_start;
    return v_week_id;
  end if;

  perform public.jourfix_carry_over(v_week_id);

  for v_item_id in
    select id from public.customer_items where show_in_jourfix and not done
  loop
    perform public.jourfix_place_customer_item(v_item_id, v_week_id);
  end loop;

  return v_week_id;
end;
$$;

revoke execute on function public.jourfix_ensure_week(date) from public, anon;
grant execute on function public.jourfix_ensure_week(date) to authenticated;

-- ------------------------------------------------------------
-- Trigger: "In JF anzeigen" an/aus bzw. Punkt wieder geöffnet
-- ------------------------------------------------------------
create or replace function public.customer_item_jourfix_sync()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_current date := date_trunc('week', current_date)::date;
  v_week_id uuid;
begin
  if tg_op = 'UPDATE'
     and new.show_in_jourfix is not distinct from old.show_in_jourfix
     and new.done is not distinct from old.done
     and new.customer_id is not distinct from old.customer_id then
    return new;
  end if;

  if new.show_in_jourfix and not new.done then
    perform public.jourfix_ensure_week(v_current);
    for v_week_id in
      select id from public.jourfix_weeks where week_start >= v_current
    loop
      perform public.jourfix_place_customer_item(new.id, v_week_id);
    end loop;
  elsif tg_op = 'UPDATE' and old.show_in_jourfix and not new.show_in_jourfix then
    -- Aus aktueller und späteren Wochen entfernen, ältere Wochen bleiben als Verlauf
    delete from public.jourfix_tasks t
      using public.jourfix_weeks w
      where w.id = t.week_id
        and t.customer_item_id = new.id
        and w.week_start >= v_current;
  end if;

  if tg_op = 'UPDATE' and new.customer_id is distinct from old.customer_id then
    update public.jourfix_tasks set customer_id = new.customer_id
      where customer_item_id = new.id and customer_id is distinct from new.customer_id;
  end if;

  return new;
end;
$$;

create trigger customer_item_jourfix_sync
  after insert or update of show_in_jourfix, done, customer_id on public.customer_items
  for each row execute procedure public.customer_item_jourfix_sync();

-- ------------------------------------------------------------
-- RPC: "In Pipeline bearbeiten" – Kundenpunkt aus einer Jourfix-Aufgabe anlegen
-- und alle Wochen-Kopien verknüpfen. Liefert customer_items.id.
-- ------------------------------------------------------------
create or replace function public.jourfix_link_customer_item(p_task_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_task public.jourfix_tasks%rowtype;
  v_item_id uuid;
begin
  if auth.role() <> 'authenticated' then
    raise exception 'not authenticated';
  end if;

  select * into v_task from public.jourfix_tasks where id = p_task_id;
  if v_task.id is null then
    raise exception 'Aufgabe nicht gefunden';
  end if;
  if v_task.customer_item_id is not null then
    return v_task.customer_item_id;
  end if;
  if v_task.customer_id is null then
    raise exception 'Bitte zuerst einen Kunden wählen';
  end if;

  -- erst ohne "In JF anzeigen" anlegen, damit der Trigger keine Dublette einsortiert
  insert into public.customer_items
    (customer_id, title, assignee_id, due_date, done, linked_task_id, created_by, show_in_jourfix,
     position)
  values (
    v_task.customer_id, v_task.title, v_task.assignee_id, v_task.due_date, v_task.done,
    v_task.linked_task_id, auth.uid(), false,
    (select coalesce(max(position) + 1, 0) from public.customer_items where customer_id = v_task.customer_id)
  )
  returning id into v_item_id;

  update public.jourfix_tasks set customer_item_id = v_item_id
    where thread_id = v_task.thread_id and customer_item_id is null;

  update public.customer_items set show_in_jourfix = true where id = v_item_id;

  return v_item_id;
end;
$$;

revoke execute on function public.jourfix_link_customer_item(uuid) from public, anon;
grant execute on function public.jourfix_link_customer_item(uuid) to authenticated;

notify pgrst, 'reload schema';
