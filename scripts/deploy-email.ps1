# Deploy edge function + email secrets to Supabase
# Prerequisites: run `npx supabase login` once, or set SUPABASE_ACCESS_TOKEN

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

if (-not $env:SUPABASE_ACCESS_TOKEN) {
  $tokenPath = Join-Path $env:USERPROFILE ".supabase\access-token"
  if (Test-Path $tokenPath) {
    $env:SUPABASE_ACCESS_TOKEN = (Get-Content $tokenPath -Raw).Trim()
  }
}

# Dashboard login != CLI auth — probe Management API before failing.
if (-not $env:SUPABASE_ACCESS_TOKEN) {
  $null = npx supabase projects list --output json 2>$null
  if ($LASTEXITCODE -eq 0) {
    Write-Host "Supabase CLI session detected (no access-token file needed)."
  }
}

if (-not $env:SUPABASE_ACCESS_TOKEN) {
  $probe = npx supabase projects list 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Supabase CLI is not authenticated in this terminal."
    Write-Host "  Dashboard login is separate from CLI deploy auth."
    Write-Host ""
    Write-Host "  Option A — paste a Personal Access Token in chat, then we retry deploy."
    Write-Host "           https://supabase.com/dashboard/account/tokens"
    Write-Host ""
    Write-Host "  Option B — in YOUR terminal (browser login):"
    Write-Host "           npx supabase login"
    Write-Host "           npm run deploy:edge"
    Write-Host ""
    if ($probe) { Write-Host "  CLI: $($probe -join ' ')" }
    exit 1
  }
}

function Invoke-Checked([string]$Label, [scriptblock]$Block) {
    Write-Host $Label
    & $Block
    if ($LASTEXITCODE -ne 0) {
        throw "$Label failed (exit $LASTEXITCODE)"
    }
}

$secretsFile = Join-Path $Root "supabase\.secrets.env"
if (-not (Test-Path $secretsFile)) {
    Write-Error "Missing supabase/.secrets.env - copy from supabase/.secrets.env.example and add your keys."
}

Invoke-Checked "Setting Supabase edge function secrets..." {
    npx supabase secrets set --env-file $secretsFile --project-ref lhbvzojmtvjeauqnnmdu
}

$fnDir = Join-Path $Root "supabase\functions\make-server-5d90ddf5"
$srcDir = Join-Path $Root "supabase\functions\server"
if (-not (Test-Path $fnDir)) {
    cmd /c mklink /J "$fnDir" "$srcDir" | Out-Null
}

Invoke-Checked "Deploying make-server-5d90ddf5..." {
    npx supabase functions deploy make-server-5d90ddf5 --project-ref lhbvzojmtvjeauqnnmdu --use-api
}

Write-Host "Done. Test: Admin -> Settings -> Send test email"

