-- Reels Agent Telegram bot session state (Edge Function + service role only)

create table if not exists public.reels_agent_sessions (
  chat_id bigint primary key,
  quests jsonb not null default '[]'::jsonb,
  xp_goal int not null default 100,
  revision_notes text not null default '',
  last_storyboard jsonb,
  skill_shoot_index int not null default 0,
  skill_edit_index int not null default 0,
  awaiting_today boolean not null default false,
  awaiting_add boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.reels_agent_sessions enable row level security;

comment on table public.reels_agent_sessions is 'Telegram Reels Agent — per-chat state for Supabase webhook bot';
