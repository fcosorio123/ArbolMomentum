# Creates figma-sync-from-github.zip and opens the scripts folder.
$root = Split-Path -Parent $PSScriptRoot
$zipRoot = Join-Path $root "figma-sync-from-github.zip"
$zipScripts = Join-Path $PSScriptRoot "figma-sync-from-github.zip"

Set-Location $root
npm run pack:figma-sync
if (-not (Test-Path $zipRoot)) {
  Write-Error "ZIP was not created. Run this from the ArbolMomentum project folder."
  exit 1
}
Copy-Item -Force $zipRoot $zipScripts
Write-Host ""
Write-Host "Created:" -ForegroundColor Green
Write-Host "  $zipScripts"
Write-Host ""
Write-Host "Upload this file in Figma Make chat, then Publish -> Update."
explorer.exe $PSScriptRoot
