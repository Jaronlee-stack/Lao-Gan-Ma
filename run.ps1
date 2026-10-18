<#
    Lao Gan Ma - one-command runner for Windows (PowerShell).

      .\run.ps1            install deps (if missing) + start backend & frontend
      .\run.ps1 -Install   install all dependencies only, then exit
      .\run.ps1 -Force     reinstall all dependencies, then start

    Backend  -> http://127.0.0.1:8000  (API, docs at /docs)
    Frontend -> http://127.0.0.1:5173  (open this in your browser)
#>
param(
    [switch]$Install,
    [switch]$Force
)

$ErrorActionPreference = "Stop"
$Root     = $PSScriptRoot
$Backend  = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"

function Find-Python {
    foreach ($cmd in @("python", "python3", "py")) {
        if (Get-Command $cmd -ErrorAction SilentlyContinue) { return $cmd }
    }
    return $null
}

# ---- pre-flight ------------------------------------------------------------
$Python = Find-Python
if (-not $Python) {
    Write-Error "Python not found. Install from https://www.python.org/downloads/ (tick 'Add Python to PATH')."
    exit 1
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "npm not found. Install Node.js from https://nodejs.org/"
    exit 1
}

# venv executables live under Scripts\ on Windows
$VenvPy  = Join-Path $Backend ".venv\Scripts\python.exe"

# ---- install dependencies --------------------------------------------------
Write-Host "==> [1/2] Backend dependencies"
Set-Location $Backend
if ($Force -and (Test-Path ".venv")) { Remove-Item -Recurse -Force ".venv" }
if (-not (Test-Path ".venv")) {
    Write-Host "    creating virtualenv (.venv)"
    & $Python -m venv .venv
}
Write-Host "    installing Python packages"
& $VenvPy -m pip install -q --upgrade pip
& $VenvPy -m pip install -q -r requirements.txt

Write-Host "==> [2/2] Frontend dependencies"
Set-Location $Frontend
if ($Force -and (Test-Path "node_modules")) { Remove-Item -Recurse -Force "node_modules" }
if (-not (Test-Path "node_modules")) {
    Write-Host "    running npm install"
    npm install --no-fund --no-audit
} else {
    Write-Host "    node_modules present (use -Force to reinstall)"
}

if ($Install) {
    Write-Host ""
    Write-Host "All dependencies installed. Run '.\run.ps1' to start the app." -ForegroundColor Green
    exit 0
}

# ---- run both servers ------------------------------------------------------
Write-Host ""
Write-Host "==> Starting backend  -> http://127.0.0.1:8000"
$backendProc = Start-Process -FilePath $VenvPy `
    -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000" `
    -WorkingDirectory $Backend -PassThru -NoNewWindow

Start-Sleep -Seconds 2
if ($backendProc.HasExited) {
    Write-Error "Backend failed to start."
    exit 1
}

Write-Host "==> Starting frontend -> http://127.0.0.1:5173  (open this in your browser)"
Write-Host "    (press Ctrl+C to stop)"
try {
    Set-Location $Frontend
    npm run dev   # foreground
}
finally {
    Write-Host ""
    Write-Host "==> Shutting down backend..."
    if (-not $backendProc.HasExited) {
        Stop-Process -Id $backendProc.Id -Force -ErrorAction SilentlyContinue
    }
}
