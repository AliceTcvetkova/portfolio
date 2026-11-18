-- Reels Agent: multi-mode content brief (optional; state also stored in last_storyboard)

alter table public.reels_agent_sessions
  add column if not exists content_brief jsonb not null default '{}'::jsonb;

comment on column public.reels_agent_sessions.content_brief is 'Last /reel brief: content_type, mood, duration, input_text';
