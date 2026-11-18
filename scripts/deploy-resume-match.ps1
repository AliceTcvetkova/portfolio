param(
    [Parameter(Mandatory = $true)]
    [string]$AccessToken
)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

$env:SUPABASE_ACCESS_TOKEN = $AccessToken

Write-Host "Linking project ugoxpdqolgkzxabvuawb..."
npx supabase link --project-ref ugoxpdqolgkzxabvuawb --yes

Write-Host "Deploying resume-match..."
npx supabase functions deploy resume-match --project-ref ugoxpdqolgkzxabvuawb

Write-Host "Done. Test: https://alicetcvetkova.github.io/portfolio/resume-matching-agent.html"
