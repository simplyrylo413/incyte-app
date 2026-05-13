-- Fitlog schema. Run once in the Supabase SQL editor (or via the CLI):
--   supabase db push
-- This script is idempotent: re-running it is safe.

-- Required for gen_random_uuid() in some Postgres builds.
create extension if not exists pgcrypto;

-- =========================================================================
-- movements
-- =========================================================================
create table if not exists public.movements (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  kind        text not null check (kind in ('weight', 'cardio')),
  unit        text check (unit in ('mi', 'km', 'm')),
  notes       text,
  created_at  timestamptz not null default now(),
  unique (user_id, name)
);

create index if not exists movements_user_idx on public.movements(user_id);

alter table public.movements enable row level security;

drop policy if exists "movements_select_own" on public.movements;
create policy "movements_select_own"
  on public.movements for select
  using (auth.uid() = user_id);

drop policy if exists "movements_insert_own" on public.movements;
create policy "movements_insert_own"
  on public.movements for insert
  with check (auth.uid() = user_id);

drop policy if exists "movements_update_own" on public.movements;
create policy "movements_update_own"
  on public.movements for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "movements_delete_own" on public.movements;
create policy "movements_delete_own"
  on public.movements for delete
  using (auth.uid() = user_id);

-- =========================================================================
-- workouts
-- =========================================================================
create table if not exists public.workouts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date        date not null,
  finished    boolean not null default false,
  notes       text,
  created_at  timestamptz not null default now()
);

create index if not exists workouts_user_date_idx on public.workouts(user_id, date desc);

alter table public.workouts enable row level security;

drop policy if exists "workouts_select_own" on public.workouts;
create policy "workouts_select_own"
  on public.workouts for select
  using (auth.uid() = user_id);

drop policy if exists "workouts_insert_own" on public.workouts;
create policy "workouts_insert_own"
  on public.workouts for insert
  with check (auth.uid() = user_id);

drop policy if exists "workouts_update_own" on public.workouts;
create policy "workouts_update_own"
  on public.workouts for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "workouts_delete_own" on public.workouts;
create policy "workouts_delete_own"
  on public.workouts for delete
  using (auth.uid() = user_id);

-- =========================================================================
-- workout_entries (one row per movement within a workout; sets stored as jsonb)
-- =========================================================================
create table if not exists public.workout_entries (
  id            uuid primary key default gen_random_uuid(),
  workout_id    uuid not null references public.workouts(id) on delete cascade,
  movement_id   uuid not null references public.movements(id) on delete restrict,
  position      int  not null default 0,
  training_type text check (training_type in ('strength','hypertrophy','power','mobility','endurance')),
  sets          jsonb not null default '[]'::jsonb,
  planned_reps  text,
  created_at    timestamptz not null default now()
);

create index if not exists workout_entries_workout_idx on public.workout_entries(workout_id, position);
create index if not exists workout_entries_movement_idx on public.workout_entries(movement_id);

alter table public.workout_entries enable row level security;

-- Restrict by joining through the parent workout (which is user-scoped).
drop policy if exists "entries_select_own" on public.workout_entries;
create policy "entries_select_own"
  on public.workout_entries for select
  using (exists (
    select 1 from public.workouts w
    where w.id = workout_entries.workout_id and w.user_id = auth.uid()
  ));

drop policy if exists "entries_insert_own" on public.workout_entries;
create policy "entries_insert_own"
  on public.workout_entries for insert
  with check (exists (
    select 1 from public.workouts w
    where w.id = workout_entries.workout_id and w.user_id = auth.uid()
  ));

drop policy if exists "entries_update_own" on public.workout_entries;
create policy "entries_update_own"
  on public.workout_entries for update
  using (exists (
    select 1 from public.workouts w
    where w.id = workout_entries.workout_id and w.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.workouts w
    where w.id = workout_entries.workout_id and w.user_id = auth.uid()
  ));

drop policy if exists "entries_delete_own" on public.workout_entries;
create policy "entries_delete_own"
  on public.workout_entries for delete
  using (exists (
    select 1 from public.workouts w
    where w.id = workout_entries.workout_id and w.user_id = auth.uid()
  ));
