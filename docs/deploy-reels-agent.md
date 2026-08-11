# Deploy Reels Agent → Supabase (Telegram webhook)

> Бот работает 24/7 на **Supabase Edge Function** — бесплатный tier, как Resume Agent.  
> На сайте портфолио **нет ссылки** на бота — только описание кейса.

## Архитектура

```
Telegram → webhook POST
    ↓
Supabase Edge Function `reels-agent`
    ↓
Postgres `reels_agent_sessions` + Groq API
    ↓
Knowledge JSON с GitHub Pages
```

---

## Шаг 1 — SQL (один раз)

Supabase Dashboard → **SQL Editor** → выполни файл:

`portfolio/supabase/phase7-reels-agent.sql`

---

## Шаг 2 — Knowledge на GitHub Pages

Файл уже сгенерирован:

`portfolio/data/reels-agent-knowledge.json`

**Push portfolio** на GitHub — иначе Edge Function не загрузит knowledge.

Обновление knowledge после правок:

```powershell
python "C:\Users\Alice\Desktop\Reelsagent\scripts\export_knowledge_json.py"
# commit + push portfolio
```

---

## Шаг 3 — Secrets в Supabase

Dashboard → **Edge Functions → Secrets**:

| Name | Value |
|------|--------|
| `TELEGRAM_BOT_TOKEN` | токен от BotFather |
| `GROQ_API_KEY` | `gsk_...` (уже может быть от resume-match) |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` |
| `OUTPUT_LANGUAGE` | `en` (on_screen_text + my_thought in storyboards) |
| `TELEGRAM_WEBHOOK_SECRET` | любая случайная строка 32+ символов |
| `TELEGRAM_ALLOWED_CHAT_IDS` | твой chat_id (только ты) |

**Как узнать chat_id:** напиши [@userinfobot](https://t.me/userinfobot) в Telegram.

---

## Шаг 4 — Deploy function

```powershell
cd "C:\Users\Alice\Desktop\portfolio"
$env:SUPABASE_ACCESS_TOKEN = "sbp_ВАШ_ТОКЕН"
npx supabase functions deploy reels-agent --project-ref ugoxpdqolgkzxabvuawb
```

Или:

```powershell
.\scripts\deploy-reels-agent.ps1 -AccessToken "sbp_..."
```

---

## Шаг 5 — Webhook Telegram

**Останови локальный бот** на ПК (иначе Conflict).

```powershell
$BOT = "ВАШ_TELEGRAM_BOT_TOKEN"
$SECRET = "ваш_TELEGRAM_WEBHOOK_SECRET"
$URL = "https://ugoxpdqolgkzxabvuawb.supabase.co/functions/v1/reels-agent"

Invoke-RestMethod "https://api.telegram.org/bot$BOT/setWebhook?url=$URL&secret_token=$SECRET"
```

Проверка:

```powershell
Invoke-RestMethod "https://api.telegram.org/bot$BOT/getWebhookInfo"
```

---

## Шаг 6 — Тест

В Telegram (только с твоего chat_id):

```
/today
✔ порисовать
/storyboard
```

Должно быть: `🤖 AI · Groq (Supabase)` + блок 📚 обучения.

---

## Локальный бот после деплоя

Локальный `python bot/main.py` **не запускай** — только Supabase webhook.

Python-версия остаётся для разработки и экспорта knowledge.

---

## Troubleshooting

| Проблема | Решение |
|----------|---------|
| Conflict | Локальный бот выключен? `getWebhookInfo` |
| 401 Unauthorized | `TELEGRAM_WEBHOOK_SECRET` совпадает в secret и setWebhook |
| Нет ответа | `TELEGRAM_ALLOWED_CHAT_IDS` = твой id |
| Knowledge fetch failed | Push portfolio с `reels-agent-knowledge.json` |
| Fallback сценарий | Groq 429 — повтори через минуту |
