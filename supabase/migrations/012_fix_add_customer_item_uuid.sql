-- ============================================================
-- Fix: jourfix_add_customer_item rief uuid_generate_v4() auf. Die Funktion
-- liegt in Supabase im Schema "extensions" und ist bei search_path = public
-- nicht sichtbar ("function uuid_generate_v4() does not exist").
-- gen_random_uuid() ist in pg_catalog und damit immer verfügbar.
-- ============================================================

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
    coalesce(v_thread_id, gen_random_uuid()),
    coalesce(v_thread_created_at, now())
  )
  returning id into v_task_id;

  return v_task_id;
end;
$$;

revoke execute on function public.jourfix_add_customer_item(uuid, uuid) from public, anon;
grant execute on function public.jourfix_add_customer_item(uuid, uuid) to authenticated;
