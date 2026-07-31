# Gemini — 3 шага до live

## 1. Gemini API key → Supabase

1. [aistudio.google.com/apikey](https://aistudio.google.com/apikey) → **Create API key**
2. [Supabase → Edge Functions → Secrets](https://supabase.com/dashboard/project/ugoxpdqolgkzxabvuawb/settings/functions)
3. Добавить:

| Name | Value |
|------|--------|
| `GEMINI_API_KEY` | ваш ключ `AIza...` |

## 2. Deploy function

```powershell
cd "C:\Users\Alice\Desktop\portfolio"
npx supabase login
npx supabase link --project-ref ugoxpdqolgkzxabvuawb
npx supabase functions deploy resume-match
```

## 3. Anon key → сайт

1. [Supabase → Settings → API](https://supabase.com/dashboard/project/ugoxpdqolgkzxabvuawb/settings/api) → **anon public**
2. Открыть `js/resume-agent-config.example.js`
3. Вставить ключ в `supabaseAnonKey`
4. Поставить `demoMode: false`
5. Commit + push

---

**Проверка:** открыть [resume-matching-agent](https://alicetcvetkova.github.io/portfolio/resume-matching-agent.html) — внизу формы должно быть «Live mode — powered by Gemini».

**Supabase Logs:** Edge Functions → resume-match → Logs (видны запросы после теста).
