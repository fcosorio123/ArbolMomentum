# ArbolMomentum Running Backup — manual snapshot before Figma Make Publish.
# Creates/updates the running-backup branch and an optional dated tag on GitHub.
#
# Usage (from repo root):
#   .\scripts\Update-RunningBackup.ps1
#   .\scripts\Update-RunningBackup.ps1 -TagOnly   # tag current HEAD without pushing branch

param(
  [switch]$TagOnly
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$branch = 'running-backup'
$stamp = Get-Date -Format 'yyyy-MM-dd-HHmm'
$tag = "running-backup/$stamp"

Write-Host ""
Write-Host "ArbolMomentum Running Backup" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan
Write-Host ""

if (-not (git rev-parse --is-inside-work-tree 2>$null)) {
  Write-Error "Not a git repository."
}

$dirty = git status --porcelain
if ($dirty) {
  Write-Host "Warning: you have uncommitted changes. Commit and push to main first for a clean backup." -ForegroundColor Yellow
}

git fetch origin

if (-not $TagOnly) {
  Write-Host "Updating origin/$branch to match current HEAD..." -ForegroundColor Green
  git push origin HEAD:refs/heads/$branch --force-with-lease
}

Write-Host "Creating tag $tag ..." -ForegroundColor Green
git tag -a $tag -m "ArbolMomentum Running Backup $stamp (pre-Figma publish snapshot)"
git push origin $tag

Write-Host ""
Write-Host "Done." -ForegroundColor Green
Write-Host "  Branch: https://github.com/fcosorio123/ArbolMomentum/tree/$branch"
Write-Host "  Tag:    $tag"
Write-Host ""
Write-Host "Safe to Publish in Figma Make — restore from running-backup if anything goes wrong."
Write-Host ""
