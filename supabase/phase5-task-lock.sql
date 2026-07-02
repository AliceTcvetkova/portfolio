-- Phase 5: lock task when proof submitted (no double pickup)
-- Run in Supabase → SQL Editor after phase4-admin.sql

create or replace function public.lock_task_on_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.tasks
  set status = 'accepted'
  where id = new.task_id and status = 'open';
  return new;
end;
$$;

drop trigger if exists on_submission_lock_task on public.submissions;
create trigger on_submission_lock_task
  after insert on public.submissions
  for each row execute function public.lock_task_on_submission();

create unique index if not exists submissions_one_pending_per_task
  on public.submissions (task_id)
  where status = 'pending';
