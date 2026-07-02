-- Phase 3b: link tasks to reports — reporter uploads "before", cleaner uploads "after"
-- Run in Supabase → SQL Editor (after phase3-auth-reports.sql)

alter table public.tasks add column if not exists report_id uuid references public.reports(id) on delete set null;
alter table public.tasks add column if not exists before_photo_path text;
alter table public.tasks add column if not exists reporter_id uuid references auth.users(id) on delete set null;

drop policy if exists "Tasks insert from reporter" on public.tasks;
create policy "Tasks insert from reporter"
  on public.tasks for insert
  to authenticated
  with check (auth.uid() = reporter_id);
