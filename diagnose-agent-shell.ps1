# Diagnose why Cursor Agent shell fails while integrated terminal works.
# Run in Cursor integrated terminal:  powershell -NoProfile -ExecutionPolicy Bypass -File .\diagnose-agent-shell.ps1

$ErrorActionPreference = 'Continue'
$report = Join-Path $PSScriptRoot 'agent-shell-diagnosis.txt'
$lines = [System.Collections.Generic.List[string]]::new()

function Add($s) { $lines.Add($s); Write-Host $s }

Add "=== Cursor Agent Shell Diagnosis ==="
Add "Date: $(Get-Date -Format o)"
Add ""

# 1. Basic environment
Add "--- Environment ---"
Add "Computer: $env:COMPUTERNAME"
Add "User: $env:USERNAME"
Add "OS: $([System.Environment]::OSVersion.VersionString)"
Add "Is64Bit: $([Environment]::Is64BitOperatingSystem)"
Add ""

# 2. PowerShell (agent hardcodes PowerShell on Windows)
Add "--- PowerShell ---"
Add "PSVersion: $($PSVersionTable.PSVersion)"
Add "PSEdition: $($PSVersionTable.PSEdition)"
try {
    $policy = Get-ExecutionPolicy -List | Out-String
    Add "ExecutionPolicy:`n$policy"
} catch { Add "ExecutionPolicy check failed: $_" }
Add ""

# 3. Cursor install
$cursorRoot = "$env:LOCALAPPDATA\Programs\cursor"
Add "--- Cursor install ---"
Add "Cursor path: $cursorRoot"
Add "Exists: $(Test-Path $cursorRoot)"
if (Test-Path "$cursorRoot\Cursor.exe") {
    $ver = (Get-Item "$cursorRoot\Cursor.exe").VersionInfo
    Add "Cursor.exe version: $($ver.FileVersion)"
}
Add ""

# 4. node-pty native module (used for pseudo-terminals)
Add "--- node-pty (PTY for terminals) ---"
$nodePty = "$cursorRoot\resources\app\node_modules\node-pty"
Add "node-pty folder: $(Test-Path $nodePty)"
$prebuilds = Join-Path $nodePty 'prebuilds'
Add "prebuilds folder: $(Test-Path $prebuilds)"
$nodeFiles = @()
if (Test-Path $nodePty) {
    $nodeFiles = Get-ChildItem -Path $nodePty -Recurse -Filter '*.node' -ErrorAction SilentlyContinue
}
Add "native .node binaries under node-pty: $($nodeFiles.Count)"
foreach ($f in $nodeFiles) { Add "  $($f.FullName)" }
Add ""

# 5. cursor-agent-exec extension
Add "--- cursor-agent-exec ---"
$agentExec = "$cursorRoot\resources\app\extensions\cursor-agent-exec"
Add "extension folder: $(Test-Path $agentExec)"
$agentNode = @()
if (Test-Path $agentExec) {
    $agentNode = Get-ChildItem -Path $agentExec -Recurse -Filter '*.node' -ErrorAction SilentlyContinue
}
Add "native .node binaries in cursor-agent-exec: $($agentNode.Count)"
foreach ($f in $agentNode) { Add "  $($f.FullName)" }
Add ""

# 6. User settings
Add "--- Cursor user settings ---"
$settingsPath = "$env:APPDATA\Cursor\User\settings.json"
if (Test-Path $settingsPath) {
    Add (Get-Content $settingsPath -Raw)
} else {
    Add "settings.json not found"
}
Add ""

# 7. Recent agent terminal state files
Add "--- Agent terminal state files ---"
$termDir = "$env:USERPROFILE\.cursor\projects\c-Projects-territory-run\terminals"
if (Test-Path $termDir) {
    Get-ChildItem $termDir -Filter '*.txt' | Sort-Object LastWriteTime -Descending | Select-Object -First 5 | ForEach-Object {
        Add ""
        Add "File: $($_.Name) (modified $($_.LastWriteTime))"
        Add (Get-Content $_.FullName -Raw)
    }
} else {
    Add "Terminals folder not found: $termDir"
}
Add ""

# 8. Event Viewer: CLR crashes (exit 0x80131506 = 2148734214)
Add "--- Recent .NET CLR crashes (last 24h) ---"
$since = (Get-Date).AddDays(-1)
$events = Get-WinEvent -FilterHashtable @{
    LogName = 'Application'
    StartTime = $since
} -ErrorAction SilentlyContinue | Where-Object {
    $_.Message -match '80131506|2148734214|Internal error in the \.NET Runtime|Cursor\.exe|cursor-agent'
} | Select-Object -First 10

if ($events) {
    foreach ($e in $events) {
        Add "[$($e.TimeCreated)] ID=$($e.Id) Provider=$($e.ProviderName)"
        Add ($e.Message -replace '\r?\n', ' ' | ForEach-Object { $_.Substring(0, [Math]::Min(500, $_.Length)) })
        Add ""
    }
} else {
    Add "No matching Application log events in last 24h (or access denied)."
    Add "Manually check: Event Viewer -> Windows Logs -> Application"
    Add "Filter for Source: .NET Runtime, Application Error; search 80131506"
}
Add ""

# 9. Quick PTY smoke test via Node (same stack Cursor uses)
Add "--- Node PTY smoke test ---"
$nodeExe = "$cursorRoot\resources\app\node_modules\@vscode\ripgrep\bin\rg.exe"
# use Cursor bundled node if present
$cursorNode = Get-ChildItem "$cursorRoot\resources\app" -Recurse -Filter 'node.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($cursorNode) {
    Add "Found bundled node: $($cursorNode.FullName)"
    $testJs = @'
try {
  const pty = require('node-pty');
  const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
  const p = pty.spawn(shell, [], { name: 'xterm', cols: 80, rows: 24, cwd: process.cwd() });
  let out = '';
  p.onData(d => { out += d; });
  p.onExit(e => { console.log('PTY_EXIT', JSON.stringify(e)); console.log('PTY_OUT', out.slice(0,200)); process.exit(e.exitCode ?? 0); });
  p.write('echo PTY_OK\r\n');
  p.write('exit\r\n');
  setTimeout(() => { console.log('PTY_TIMEOUT'); process.exit(1); }, 10000);
} catch (e) {
  console.log('PTY_ERROR', e && (e.stack || e.message || e));
  process.exit(2);
}
'@
    $tmpJs = Join-Path $env:TEMP 'cursor-pty-test.js'
    Set-Content -Path $tmpJs -Value $testJs -Encoding UTF8
    $env:NODE_PATH = "$cursorRoot\resources\app\node_modules"
    $result = & $cursorNode.FullName $tmpJs 2>&1 | Out-String
    Add $result.Trim()
} else {
    Add "Bundled node.exe not found under Cursor install."
}
Add ""

Add "=== Done. Full report saved to: $report ==="
$lines | Set-Content -Path $report -Encoding UTF8
