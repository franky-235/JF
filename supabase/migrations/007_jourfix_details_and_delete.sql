-- Freitext-Details je Jourfix-Aufgabe.
alter table public.jourfix_tasks add column details text;

-- Admins dürfen Bereiche löschen (Aufgaben darin kaskadieren bereits über die FK).
create policy "Admins can delete jourfix_areas"
  on public.jourfix_areas for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
