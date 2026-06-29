# Territory Run - commit, push (Render deploy), Android APK
# Run from repo root:
#   powershell -ExecutionPolicy Bypass -File .\scripts\release-and-android.ps1
#
# Options:
#   -SkipCommit    build + Android only (no git)
#   -SkipPush      commit locally, no push
#   -SkipAndroid   commit + push only
#   -Release       assembleRelease instead of debug APK

param(
    [switch]$SkipCommit,
    [switch]$SkipPush,
    [switch]$SkipAndroid,
    [switch]$Release
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "=== Territory Run release ===" -ForegroundColor Cyan

if (-not $SkipCommit) {
    Write-Host "`n[1/5] Git add + commit..." -ForegroundColor Yellow

    $paths = @(
        "GAME_CONSTANTS.md",
        "render.yaml",
        "docs/",
        "apps/api/.env.example",
        "apps/api/prisma/",
        "apps/api/scripts/backfill-activity-results.ts",
        "apps/api/src/",
        "apps/api/package.json",
        "apps/web/src/",
        "apps/web/public/",
        "apps/web/index.html",
        "apps/web/vite.config.ts",
        "apps/web/package.json",
        "apps/web/capacitor.config.ts",
        "apps/web/android/"
    )

    git add @paths

    # Mechanics doc (Cyrillic filename - resolve at runtime, no Cyrillic in script source)
    Get-ChildItem -Path . -File -Filter "*.txt" |
        Where-Object { $_.Name -notmatch "agent-shell" } |
        ForEach-Object { git add -- $_.FullName }

    git add -u diagnose-agent-shell.ps1 diagnose-agent-shell-v2.ps1 2>$null

    $status = git status --short
    if (-not $status) {
        Write-Host "Nothing to commit." -ForegroundColor Gray
    } else {
        git commit `
            -m "Ship game mechanics, Paper Atlas UI, and QA fixes." `
            -m "Influence soft cap, streak/home multipliers, decay 60d, anticheat 28 km/h." `
            -m "Activity results backfill, feed dedupe, regional leaderboard metrics." `
            -m "Paper Atlas phases 1-3, tutorial, siege notifications, share card." `
            -m "Map missions, capture targets, home area geocode; QA UI fixes."
        Write-Host "Committed." -ForegroundColor Green
    }
}

if (-not $SkipPush -and -not $SkipCommit) {
    Write-Host "`n[2/5] Push to origin (Render auto-deploy)..." -ForegroundColor Yellow
    git push origin HEAD
    Write-Host "Pushed. Render redeploys territory-run-api and territory-run-web." -ForegroundColor Green
    Write-Host "  API:  https://territory-run-api-erbs.onrender.com" -ForegroundColor Gray
    Write-Host "  Web:  https://territory-run-cjoj.onrender.com" -ForegroundColor Gray
    Write-Host "  After prod deploy (if needed):" -ForegroundColor Gray
    Write-Host "    pnpm --filter api exec prisma migrate deploy" -ForegroundColor Gray
    Write-Host "    pnpm --filter api backfill:activity-results" -ForegroundColor Gray
} elseif ($SkipCommit) {
    Write-Host "`n[2/5] Push skipped (SkipCommit)." -ForegroundColor Gray
} else {
    Write-Host "`n[2/5] Push skipped (SkipPush)." -ForegroundColor Gray
}

Write-Host "`n[3/5] API tests..." -ForegroundColor Yellow
pnpm --filter api test
if ($LASTEXITCODE -ne 0) { throw "API tests failed" }

if ($SkipAndroid) {
    Write-Host "`n[4/5][5/5] Android skipped (SkipAndroid)." -ForegroundColor Gray
    exit 0
}

Write-Host "`n[4/5] Web build + Capacitor sync..." -ForegroundColor Yellow
Push-Location apps\web
pnpm build
if ($LASTEXITCODE -ne 0) { throw "Web build failed" }
npx cap sync android
if ($LASTEXITCODE -ne 0) { throw "cap sync failed" }

Write-Host "`n[5/5] Android APK..." -ForegroundColor Yellow
Push-Location android
if ($Release) {
    .\gradlew.bat assembleRelease
    $apk = Get-ChildItem -Recurse -Filter "*release*.apk" app\build\outputs\apk\release | Select-Object -First 1
} else {
    .\gradlew.bat assembleDebug
    $apk = Get-ChildItem -Recurse -Filter "*debug*.apk" app\build\outputs\apk\debug | Select-Object -First 1
}
Pop-Location
Pop-Location

if ($apk) {
    Write-Host "`nAPK: $($apk.FullName)" -ForegroundColor Green
    Write-Host "Install: adb install -r `"$($apk.FullName)`"" -ForegroundColor Gray
} else {
    Write-Host "APK not found - open Android Studio: npx cap open android" -ForegroundColor Yellow
}

Write-Host "`nDone." -ForegroundColor Cyan
