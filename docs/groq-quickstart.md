# LLM для Resume Agent — если Gemini / AI Studio недоступен

## Почему Analytics открылся, а AI Studio — нет

Это **разные продукты** с разными правилами:

| Сервис | Доступ из РФ |
|--------|----------------|
| Google Analytics | Обычно работает через VPN |
| **Google AI Studio / Gemini API key** | **Россия не в списке поддерживаемых регионов** |

Google проверяет не только IP, но и:
- страну Google-аккаунта
- номер телефона (+7)
- историю входов

VPN **не гарантирует** доступ к AI Studio, даже если Analytics открывается.

---

## Рекомендация: Groq (бесплатно, без AI Studio)

### 1. Получить ключ

1. Happ ON, сервер EU (на всякий случай)
2. https://console.groq.com → Sign up (email или Google)
3. **API Keys** → Create API Key

Обычно регистрация проходит без блокировки региона.

### 2. Supabase Secrets

| Name | Value |
|------|--------|
| `GROQ_API_KEY` | `gsk_...` |
| `LLM_PROVIDER` | `groq` |

Gemini key **не нужен**.

### 3. Deploy

```powershell
cd "C:\Users\Alice\Desktop\portfolio"
npx supabase functions deploy resume-match
```

---

## Если всё же хотите Gemini

### Попробуйте другой URL

Не `/apikey`, а:

**https://aistudio.google.com/app/apikey**

### Максимальный шанс (не всегда работает)

1. Happ → сервер **Finland / Germany / USA**
2. **Chrome Incognito**
3. Google-аккаунт **без привязки к РФ** (или новый, созданный только под VPN)
4. https://aistudio.google.com/app/apikey

Если пишет *"not available in your region"* — это блок аккаунта/страны, VPN не поможет.

---

## Happ: DNS снова сбросился

Happ перезаписал `config.json` на старый (DNS мимо VPN).  
Конфиг **восстановлен** — **отключите и включите VPN** в Happ.

Проверка IP: https://ifconfig.me — должен быть не Россия.

---

## Итого

| Путь | Сложность | Для вас |
|------|-----------|---------|
| **Groq** | Низкая | ✅ Рекомендуем |
| Gemini через AI Studio | Высокая (регион) | ⚠️ Может не получиться |
| Demo mode на сайте | Нулевая | Уже работает |
| Cursor локально | Нулевая | Без API keys |
