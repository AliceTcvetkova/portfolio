/**
 * Live config: paste Supabase anon key and set demoMode: false.
 * LLM runs via Gemini on Supabase (free) — key only in Supabase Secrets as GEMINI_API_KEY.
 * See docs/resume-agent-setup.md
 */
window.RESUME_AGENT_CONFIG = {
  supabaseUrl: "https://ugoxpdqolgkzxabvuawb.supabase.co",
  supabaseAnonKey: "PASTE_ANON_KEY_HERE",
  functionName: "resume-match",
  /** false = live Gemini API; true = placeholder results */
  demoMode: true
};