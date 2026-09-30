-- ============================================================
-- Spalte "Thema" für Jourfix-Aufgaben (Kategorie "Kunden" nutzt stattdessen den Kunden)
-- Setzt 010 voraus.
-- ============================================================

alter table public.jourfix_tasks add column topic text;

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
     carried_over_count, origin_task_id, linked_task_id, customer_item_id, created_by,
     thread_id, thread_created_at)
  select
    p_week_id,
    prev.area_id,
    prev.topic,
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

revoke execute on function public.jourfix_carry_over(uuid) from public, anon;
grant execute on function public.jourfix_carry_over(uuid) to authenticated;
