-- Roommate matcher requests for Housing module (source-of-truth: this migration)

create table if not exists public.roommate_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  preferred_gender text not null default 'any' check (preferred_gender in ('male', 'female', 'any')),
  preferred_faculty text,
  sleep_schedule text not null default 'flexible' check (sleep_schedule in ('early', 'late', 'flexible')),
  smoking_preference text not null default 'either' check (smoking_preference in ('no', 'yes', 'either')),
  budget_min numeric,
  budget_max numeric,
  area text,
  phone text,
  created_at timestamptz not null default now(),
  constraint roommate_requests_budget_range_check check (
    budget_min is null or budget_max is null or budget_min <= budget_max
  )
);

create index if not exists idx_roommate_requests_created_at
  on public.roommate_requests(created_at desc);

create index if not exists idx_roommate_requests_user_id
  on public.roommate_requests(user_id);

alter table public.roommate_requests enable row level security;

drop policy if exists "Anyone can view roommate requests" on public.roommate_requests;
create policy "Anyone can view roommate requests"
  on public.roommate_requests
  for select
  to authenticated
  using (true);

drop policy if exists "Users can create own roommate requests" on public.roommate_requests;
create policy "Users can create own roommate requests"
  on public.roommate_requests
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own roommate requests" on public.roommate_requests;
create policy "Users can update own roommate requests"
  on public.roommate_requests
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own roommate requests" on public.roommate_requests;
create policy "Users can delete own roommate requests"
  on public.roommate_requests
  for delete
  to authenticated
  using (auth.uid() = user_id);
