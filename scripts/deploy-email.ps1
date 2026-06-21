# Deploy edge function + email secrets to Supabase
# Prerequisites: run `npx supabase login` once, or set SUPABASE_ACCESS_TOKEN

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

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
    npx supabase functions deploy make-server-5d90ddf5 --project-ref lhbvzojmtvjeauqnnmdu
}

Write-Host "Done. Test: Admin -> Settings -> Send test email"
