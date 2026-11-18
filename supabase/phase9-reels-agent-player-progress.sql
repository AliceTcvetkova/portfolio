-- Reels Agent: persisted player progress (resources + goal bars)

alter table public.reels_agent_sessions
  add column if not exists player_progress jsonb not null default '{}'::jsonb;

comment on column public.reels_agent_sessions.player_progress is
  'Level 33 resource balances, song cover investment, unlocks, recent log';

-- Public read-only snapshot for portfolio page (single row)
create table if not exists public.reels_agent_public_progress (
  id int primary key default 1 check (id = 1),
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.reels_agent_public_progress enable row level security;

drop policy if exists "Public read reels progress" on public.reels_agent_public_progress;
create policy "Public read reels progress"
  on public.reels_agent_public_progress
  for select
  using (true);

comment on table public.reels_agent_public_progress is
  'Live Level 33 progress for portfolio reels-agent.html (service role writes via Edge bot)';

-- Seed row
insert into public.reels_agent_public_progress (id, payload)
values (1, '{"level":33,"resources":{},"goals":[],"unlocks":[]}'::jsonb)
on conflict (id) do nothing;
