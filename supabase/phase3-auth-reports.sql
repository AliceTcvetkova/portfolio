-- Phase 3: profiles, reports, submissions, photo storage
-- Run in Supabase → SQL Editor after phase2-tasks.sql

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  points integer not null default 0,
  cleanups integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Pollution report',
  location_name text not null,
  lat double precision not null,
  lng double precision not null,
  category text not null,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high')),
  reward_points integer not null default 240,
  photo_path text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  before_photo_path text not null,
  after_photo_path text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.reports enable row level security;
alter table public.submissions enable row level security;

drop policy if exists "Profiles read own" on public.profiles;
create policy "Profiles read own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Profiles update own" on public.profiles;
create policy "Profiles update own"
  on public.profiles for update
  using (auth.uid() = id);

drop policy if exists "Reports insert own" on public.reports;
create policy "Reports insert own"
  on public.reports for insert
  with check (auth.uid() = user_id);

drop policy if exists "Reports read own" on public.reports;
create policy "Reports read own"
  on public.reports for select
  using (auth.uid() = user_id);

drop policy if exists "Submissions insert own" on public.submissions;
create policy "Submissions insert own"
  on public.submissions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Submissions read own" on public.submissions;
create policy "Submissions read own"
  on public.submissions for select
  using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do update set public = true;

drop policy if exists "Photos public read" on storage.objects;
create policy "Photos public read"
  on storage.objects for select
  using (bucket_id = 'photos');

drop policy if exists "Photos auth upload own folder" on storage.objects;
create policy "Photos auth upload own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
