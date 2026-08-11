-- Teilnehmende Mitglieder pro Jourfix-Woche.
create table public.jourfix_week_participants (
  week_id uuid not null references public.jourfix_weeks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (week_id, user_id)
);

alter table public.jourfix_week_participants enable row level security;

create policy "Authenticated users can view jourfix_week_participants"
  on public.jourfix_week_participants for select using (auth.role() = 'authenticated');

create policy "Admins can manage jourfix_week_participants"
  on public.jourfix_week_participants for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
