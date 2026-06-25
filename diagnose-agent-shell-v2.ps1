# Simulates Cursor agent shell spawn more closely than basic powershell -NoProfile tests.
# Run: powershell -NoProfile -ExecutionPolicy Bypass -File .\diagnose-agent-shell-v2.ps1

$ErrorActionPreference = 'Continue'
$report = Join-Path $PSScriptRoot 'agent-shell-diagnosis-v2.txt'
$lines = [System.Collections.Generic.List[string]]::new()
function Add($s) { $lines.Add($s); Write-Host $s }

Add "=== Agent-like spawn simulation ==="
Add "Date: $(Get-Date -Format o)"
Add ""

$cursorRoot = "$env:LOCALAPPDATA\Programs\cursor"
$nodeExe = Get-ChildItem "$cursorRoot\resources\app" -Recurse -Filter 'node.exe' -ErrorAction SilentlyContinue | Select-Object -First 1

if (-not $nodeExe) {
    Add "ERROR: Cursor bundled node.exe not found"
    $lines | Set-Content $report -Encoding UTF8
    exit 1
}

Add "Using node: $($nodeExe.FullName)"
Add ""

# VSCODE/Cursor-like env vars (integrated terminal has these; agent may inject similar)
$vscodeEnv = @{
    VSCODE_INJECTION = '1'
    VSCODE_PID = $PID.ToString()
    VSCODE_CWD = $PSScriptRoot
    VSCODE_IPC_HOOK = 'cursor-simulated-hook'
    TERM_PROGRAM = 'vscode'
    TERM_PROGRAM_VERSION = '3.8.23'
    COLORTERM = 'truecolor'
}

$testJs = @'
const pty = require('node-pty');
const tests = [
  { name: 'powershell default', shell: 'powershell.exe', args: [] },
  { name: 'powershell -NoProfile', shell: 'powershell.exe', args: ['-NoProfile'] },
  { name: 'powershell -NoProfile -NonInteractive', shell: 'powershell.exe', args: ['-NoProfile', '-NonInteractive'] },
  { name: 'powershell -NoProfile -Command echo', shell: 'powershell.exe', args: ['-NoProfile', '-Command', 'echo PTY_CMD_TEST'] },
  { name: 'cmd.exe', shell: 'cmd.exe', args: [] },
];

const vscodeEnv = JSON.parse(process.env.CURSOR_SIM_ENV || '{}');
let failed = 0;

function runTest(test) {
  return new Promise((resolve) => {
    const env = { ...process.env, ...vscodeEnv };
    const start = Date.now();
    let out = '';
    let crashed = false;
    try {
      const p = pty.spawn(test.shell, test.args, {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: process.env.CURSOR_SIM_CWD || process.cwd(),
        env,
      });
      const timer = setTimeout(() => {
        crashed = true;
        try { p.kill(); } catch (_) {}
        resolve({ test: test.name, ok: false, ms: Date.now() - start, out: out.slice(0, 300), error: 'TIMEOUT_15s' });
      }, 15000);
      p.onData(d => { out += d; });
      p.onExit(e => {
        clearTimeout(timer);
        const code = e.exitCode;
        const ok = !crashed && code === 0;
        if (!ok) failed++;
        resolve({ test: test.name, ok, ms: Date.now() - start, exitCode: code, out: out.slice(0, 300) });
      });
      p.write('echo SPAWN_OK\r\n');
      p.write('exit\r\n');
    } catch (e) {
      failed++;
      resolve({ test: test.name, ok: false, ms: Date.now() - start, error: String(e.stack || e) });
    }
  });
}

(async () => {
  for (const t of tests) {
    const r = await runTest(t);
    console.log('RESULT ' + JSON.stringify(r));
  }
  console.log('SUMMARY failed=' + failed + ' total=' + tests.length);
  process.exit(failed > 0 ? 1 : 0);
})();
'@

$tmpJs = Join-Path $env:TEMP 'cursor-agent-spawn-sim.js'
Set-Content -Path $tmpJs -Value $testJs -Encoding UTF8

$env:NODE_PATH = "$cursorRoot\resources\app\node_modules"
$env:CURSOR_SIM_CWD = $PSScriptRoot
$env:CURSOR_SIM_ENV = ($vscodeEnv | ConvertTo-Json -Compress)

Add "--- PTY spawn tests with VSCODE-like env ---"
Add "VSCODE_INJECTION=1, TERM_PROGRAM=vscode, cwd=$PSScriptRoot"
Add ""

$output = & $nodeExe.FullName $tmpJs 2>&1 | ForEach-Object { $_.ToString() }
foreach ($line in $output) { Add $line }

Add ""
Add "--- Check Event Viewer for new powershell APPCRASH (last 5 min) ---"
$since = (Get-Date).AddMinutes(-5)
$events = Get-WinEvent -FilterHashtable @{ LogName = 'Application'; StartTime = $since } -ErrorAction SilentlyContinue |
    Where-Object { $_.Message -match '80131506|powershell\.exe' } |
    Select-Object -First 5
if ($events) {
    foreach ($e in $events) { Add "[$($e.TimeCreated)] $($e.ProviderName) ID=$($e.Id)" }
} else {
    Add "No new powershell CLR crashes in last 5 minutes."
}

Add ""
Add "Report: $report"
$lines | Set-Content -Path $report -Encoding UTF8
