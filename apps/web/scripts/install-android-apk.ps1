$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$javaHome = "C:\Program Files\Android\Android Studio\jbr"
if (Test-Path "$javaHome\bin\java.exe") {
    $env:JAVA_HOME = $javaHome
    $env:Path = "$javaHome\bin;$env:Path"
}

Write-Host "Syncing Android shell (live website — same as PWA from browser)..." -ForegroundColor Cyan
node ./scripts/sync-android-shell.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
node ./scripts/patch-capacitor-settings.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Android resources..." -ForegroundColor Cyan
node ./scripts/ensure-android-resources.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
node ./scripts/ensure-android-sources.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Building debug APK..." -ForegroundColor Cyan
Push-Location android
& .\gradlew.bat clean assembleDebug
$gradleExit = $LASTEXITCODE
Pop-Location
if ($gradleExit -ne 0) {
    exit $gradleExit
}

$buildDir = Join-Path (Get-Location) "android\app\build"
$apk = Get-ChildItem -Path $buildDir -Recurse -Filter "*.apk" -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -match '\\outputs\\apk\\' -and $_.Name -notmatch 'androidTest' } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

if (-not $apk) {
    $anyApk = Get-ChildItem -Path $buildDir -Recurse -Filter "*.apk" -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    if ($anyApk) {
        $apk = $anyApk
    }
}

if (-not $apk) {
    Write-Host "APK not found under $buildDir" -ForegroundColor Red
    exit 1
}

Write-Host "APK: $($apk.FullName)" -ForegroundColor Green

$adbExe = $null
$adbCmd = Get-Command adb -ErrorAction SilentlyContinue
if ($adbCmd) {
    $adbExe = $adbCmd.Source
}
$sdkAdb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
if (-not $adbExe -and (Test-Path $sdkAdb)) {
    $adbExe = $sdkAdb
}

if (-not $adbExe) {
    Write-Host "Copy APK to phone manually:" -ForegroundColor Yellow
    Write-Host $apk.FullName
    exit 0
}

Write-Host "Connected devices:" -ForegroundColor Cyan
& $adbExe devices

Write-Host "Installing..." -ForegroundColor Cyan
& $adbExe install -r $apk.FullName
if ($LASTEXITCODE -ne 0) {
    Write-Error "adb install failed. Enable USB debugging on phone."
}
Write-Host "Done. Opens https://territory-run-cjoj.onrender.com/ (same as browser PWA)" -ForegroundColor Green
Write-Host "Version 2.1.2 — toast on launch must say 'Territory Run 2.1.2 → Render'." -ForegroundColor Gray
