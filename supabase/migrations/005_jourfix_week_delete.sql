-- Erlaubt Admins, einen Jourfix-Zeitraum (Woche) samt seiner Aufgaben zu löschen.
create policy "Admins can delete jourfix_weeks"
  on public.jourfix_weeks for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
