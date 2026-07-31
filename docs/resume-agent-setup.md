# Resume Matching Agent — Supabase setup

## 1. Secrets (Supabase Dashboard → Edge Functions → Secrets)

```
OPENAI_API_KEY=sk-...
```

## 2. Deploy function

```bash
cd portfolio
npx supabase login
npx supabase link --project-ref ugoxpdqolgkzxabvuawb
npx supabase functions deploy resume-match
```

## 3. Frontend config

Copy `js/resume-agent-config.example.js` → `js/resume-agent-config.js`:

```js
window.RESUME_AGENT_CONFIG = {
  supabaseUrl: "https://ugoxpdqolgkzxabvuawb.supabase.co",
  supabaseAnonKey: "YOUR_ANON_KEY",
  functionName: "resume-match"
};
```

## 4. Update knowledge after CV changes

```bash
python "../AI vacancy analyst/scripts/export_knowledge_json.py"
git add data/resume-knowledge.json && git commit && git push
```

The edge function loads knowledge from GitHub Pages URL on each request.

## Actions

| action | Description |
|--------|-------------|
| `analyze` | Parse vacancy + match → %, highlights, concerns |
| `get_cv` | Tailor + validate CV (requires prior analyze context) |

Cover letter agent is **not** exposed on the public site (by design).
