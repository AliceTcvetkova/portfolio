# Deploy resume-match Edge Function

Requires a Supabase **access token** (not anon key, not Groq key).

## 1. Create token (one time)

1. https://supabase.com/dashboard/account/tokens  
2. **Generate new token** → copy `sbp_...`

## 2. Deploy (PowerShell)

```powershell
cd "C:\Users\Alice\Desktop\portfolio"
$env:SUPABASE_ACCESS_TOKEN = "sbp_ВАШ_ТОКЕН"
npm install
npx supabase link --project-ref ugoxpdqolgkzxabvuawb --yes
npx supabase functions deploy resume-match --project-ref ugoxpdqolgkzxabvuawb
```

Or:

```powershell
.\scripts\deploy-resume-match.ps1 -AccessToken "sbp_..."
```

## 3. Secrets (already done by you)

- `GROQ_API_KEY`
- `LLM_PROVIDER` = `groq`

## 4. Test

https://alicetcvetkova.github.io/portfolio/resume-matching-agent.html
