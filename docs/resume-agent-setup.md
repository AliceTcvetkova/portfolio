# Resume Matching Agent — бесплатная настройка

Стоимость **$0**, если использовать:
- **GitHub Pages** — хостинг сайта (уже есть)
- **Supabase Free** — Edge Functions (500K вызовов/мес)
- **Google Gemini API Free** — LLM без карты (лимиты по запросам/день)

OpenAI **не нужен**.

---

## Шаг 1 — Gemini API key (бесплатно)

1. Откройте [Google AI Studio](https://aistudio.google.com/apikey)
2. Войдите через Google-аккаунт
3. **Create API key** → скопируйте ключ

Карта не нужна. Free tier постоянный, не trial.

**Модель по умолчанию:** `gemini-2.0-flash-lite` (~1000 запросов/день на free tier — достаточно для портфолио).

---

## Шаг 2 — Secret в Supabase

[Supabase Dashboard](https://supabase.com/dashboard/project/ugoxpdqolgkzxabvuawb) → **Edge Functions** → **Secrets**

| Name | Value |
|------|--------|
| `GEMINI_API_KEY` | ваш ключ из AI Studio |

Опционально:

| Name | Value |
|------|--------|
| `GEMINI_MODEL` | `gemini-2.0-flash-lite` (default) или `gemini-2.5-flash-lite` |

---

## Шаг 3 — Anon key (для сайта)

**Project Settings → API** → скопируйте **anon public** key.

---

## Шаг 4 — Деплой функции

```powershell
cd "C:\Users\Alice\Desktop\portfolio"
npx supabase login
npx supabase link --project-ref ugoxpdqolgkzxabvuawb
npx supabase functions deploy resume-match
```

---

## Шаг 5 — Подключить фронт

1. Скопируйте `js/resume-agent-config.example.js` → `js/resume-agent-config.js`
2. Вставьте anon key, `demoMode: false`
3. В `resume-matching-agent.html` подключите `resume-agent-config.js` вместо `.example.js`
4. Push на GitHub

---

## Лимиты free tier (ориентир)

| Действие | Вызовов LLM | На 250 RPD (Flash) |
|----------|-------------|---------------------|
| Analyze match | 1 | ~250 анализов/день |
| Get a CV | +1 | ~125 полных прогонов/день |

Если видите «quota exceeded» — подождите минуту или используйте `gemini-2.0-flash-lite` (больше RPD).

**Eco Clean Map** и resume-agent делят один Supabase project — квота Gemini общая на Google Cloud project.

---

## Альтернатива: Groq (тоже free)

1. [console.groq.com](https://console.groq.com) → API key  
2. Secret `GROQ_API_KEY` + доработка функции (сейчас настроен Gemini)

---

## Что остаётся платным

| Сервис | Free? |
|--------|-------|
| GitHub Pages | ✅ |
| Supabase Edge Functions | ✅ (free tier) |
| Gemini API | ✅ (rate limits) |
| OpenAI | ❌ платный |

---

## Обновление базы знаний

```powershell
python "C:\Users\Alice\Desktop\AI vacancy analyst\scripts\export_knowledge_json.py"
cd "C:\Users\Alice\Desktop\portfolio"
git add data/resume-knowledge.json
git commit -m "Update resume knowledge base"
git push
```

Функция подтягивает JSON с GitHub Pages автоматически.
