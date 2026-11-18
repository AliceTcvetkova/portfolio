param(
  [Parameter(Mandatory = $true)]
  [string]$AccessToken,
  [string]$ProjectRef = "ugoxpdqolgkzxabvuawb"
)

$ErrorActionPreference = "Stop"
$env:SUPABASE_ACCESS_TOKEN = $AccessToken

Set-Location $PSScriptRoot\..

Write-Host "Export reels knowledge JSON..."
python "C:\Users\Alice\Desktop\Reelsagent\scripts\export_knowledge_json.py"

Write-Host "Deploy reels-agent..."
npx supabase functions deploy reels-agent --project-ref $ProjectRef

Write-Host "Done. Next: set webhook — see docs/deploy-reels-agent.md"
