$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$bundled = $env:CAPACITOR_BUNDLED_UI -eq 'true'

if ($bundled) {
    Write-Host "Gradle: bundling UI into APK..." -ForegroundColor Cyan
    pnpm exec vite build --mode capacitor
} else {
    Write-Host "Gradle: APK uses live UI from Render (deploy web with git push first)" -ForegroundColor Cyan
    if (-not (Test-Path "dist\index.html")) {
        pnpm exec vite build --mode capacitor
    }
}

pnpm exec cap sync android
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Gradle: cap sync finished" -ForegroundColor Green
