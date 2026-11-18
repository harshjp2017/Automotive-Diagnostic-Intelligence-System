@echo off
setlocal EnableExtensions
title DTC Diagnostics ADK - Auto-Restart Watcher

REM Always run inside the application directory
cd /d "%~dp0"

echo ============================================================================
echo   Automotive Diagnostic Intelligence System (Google ADK Compatible)
echo   Auto-Restart Watchdog Supervisor (Port 3000)
echo ============================================================================
echo.

REM Prefer WinGet/User Bun if available, otherwise fall back to npm
where bun >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    if exist "%LOCALAPPDATA%\Microsoft\WinGet\Packages\Oven-sh.Bun_Microsoft.Winget.Source_8wekyb3d8bbwe\bun-windows-x64\bun.exe" (
        set "PATH=%LOCALAPPDATA%\Microsoft\WinGet\Packages\Oven-sh.Bun_Microsoft.Winget.Source_8wekyb3d8bbwe\bun-windows-x64;%PATH%"
    ) else if exist "%USERPROFILE%\.bun\bin\bun.exe" (
        set "PATH=%USERPROFILE%\.bun\bin;%PATH%"
    ) else (
        for /d %%D in ("%LOCALAPPDATA%\Microsoft\WinGet\Packages\Oven-sh.Bun_*") do (
            if exist "%%~D\bun-windows-x64\bun.exe" set "PATH=%%~D\bun-windows-x64;%PATH%"
        )
    )
)

REM Expose uv / agents-cli / Python 3.13 ahead of WindowsApps Store stub when installed
if exist "%USERPROFILE%\.local\bin" set "PATH=%USERPROFILE%\.local\bin;%PATH%"
if exist "%LOCALAPPDATA%\Programs\Python\Python313" set "PATH=%LOCALAPPDATA%\Programs\Python\Python313;%LOCALAPPDATA%\Programs\Python\Python313\Scripts;%PATH%"

set "PKG_MGR=npm"
where bun >nul 2>nul
if %ERRORLEVEL% EQU 0 set "PKG_MGR=bun"

if not "%PKG_MGR%"=="bun" (
    where npm >nul 2>nul
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Neither Bun nor Node.js/npm was found in PATH.
        echo Install Node.js LTS from https://nodejs.org/ or Bun from https://bun.sh/
        pause
        exit /b 1
    )
)

if /I "%~1"=="--check" set "DTC_WATCHER_DRY_RUN=1"
if /I "%~1"=="-Check" set "DTC_WATCHER_DRY_RUN=1"

if not "%DTC_WATCHER_DRY_RUN%"=="1" (
    if not exist ".env" (
        echo [WARNING] No .env file found. Server will start with local RAG/ADK fallbacks.
        echo           Copy .env.example to .env and set GEMINI_API_KEY for live Gemini calls.
        echo.
    )

    if not exist "node_modules\.bin\tsx.cmd" (
        echo [Setup] Installing dependencies using %PKG_MGR%...
        if "%PKG_MGR%"=="bun" (
            call bun install --backend=copyfile
        ) else (
            call npm install
        )
        if %ERRORLEVEL% NEQ 0 (
            echo [ERROR] Dependency installation failed.
            pause
            exit /b 1
        )
    )
)

set "DTC_BAT_PATH=%~f0"
set "DTC_PKG_MGR=%PKG_MGR%"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$p = $env:DTC_BAT_PATH; $raw = Get-Content -LiteralPath $p -Raw; $m = '# === ' + 'POWERSHELL_SUPERVISOR ==='; $i = $raw.IndexOf($m); if ($i -lt 0) { Write-Error 'Supervisor marker missing'; exit 2 }; & ([ScriptBlock]::Create($raw.Substring($i)))"
exit /b %ERRORLEVEL%

# === POWERSHELL_SUPERVISOR ===
$ErrorActionPreference = 'Stop'
$AppDir = (Get-Location).Path
$PkgMgr = if ($env:DTC_PKG_MGR) { $env:DTC_PKG_MGR } else { 'npm' }
$DryRun = $env:DTC_WATCHER_DRY_RUN -eq '1'

$WatchedRootFiles = @(
    'server.ts',
    'package.json',
    'vite.config.ts',
    'tsconfig.json',
    'index.html',
    '.env',
    'pyproject.toml',
    'agents-cli-manifest.yaml',
    'requirements.txt',
    'smoke_test.py'
)

$WatchedDirs = @('server', 'src', 'app', 'api', 'retrieval', 'evals', 'ingest')
$IgnoredDirPattern = '([\\/]|^)(node_modules|dist|\.git|\.venv|__pycache__)([\\/]|$)'
$IgnoredExt = @('.pyc', '.pyo', '.log', '.tmp')

function Get-WatchSnapshot {
    $records = New-Object System.Collections.Generic.List[string]
    $pkgStamp = ''

    foreach ($rel in $WatchedRootFiles) {
        $full = Join-Path $AppDir $rel
        if (Test-Path -LiteralPath $full -PathType Leaf) {
            $fi = Get-Item -LiteralPath $full -ErrorAction SilentlyContinue
            if ($null -ne $fi) {
                $line = "$rel|$($fi.Length)|$($fi.LastWriteTimeUtc.Ticks)"
                $records.Add($line)
                if ($rel -eq 'package.json') {
                    $pkgStamp = $line
                }
            }
        }
    }

    foreach ($dir in $WatchedDirs) {
        $dirPath = Join-Path $AppDir $dir
        if (Test-Path -LiteralPath $dirPath -PathType Container) {
            Get-ChildItem -LiteralPath $dirPath -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object {
                $fullPath = $_.FullName
                if ($fullPath -match $IgnoredDirPattern) { return }
                if ($_.Name -eq 'custom_manuals.json') { return }
                if ($IgnoredExt -contains $_.Extension.ToLowerInvariant()) { return }
                $relPath = $fullPath.Substring($AppDir.Length).TrimStart('\', '/')
                $records.Add("$relPath|$($_.Length)|$($_.LastWriteTimeUtc.Ticks)")
            }
        }
    }

    $sorted = $records | Sort-Object
    $joined = [string]::Join("`n", $sorted)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $hashBytes = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($joined))
        $hashHex = ([System.BitConverter]::ToString($hashBytes) -replace '-', '')
    } finally {
        $sha.Dispose()
    }

    return @{
        FileCount = $records.Count
        Hash      = $hashHex
        PkgStamp  = $pkgStamp
    }
}

function Stop-ProcessTree {
    param([int]$ParentPid)
    if ($ParentPid -gt 0) {
        try {
            & taskkill.exe /F /T /PID $ParentPid 2>&1 | Out-Null
        } catch {}
    }
}

function Clear-Port3000 {
    try {
        $conns = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
        foreach ($c in $conns) {
            if ($c.OwningProcess -gt 0) {
                Write-Host "[Supervisor] Clearing existing listener PID $($c.OwningProcess) on port 3000..." -ForegroundColor Yellow
                Stop-ProcessTree -ParentPid $c.OwningProcess
            }
        }
    } catch {}
}

function Start-AppServer {
    Clear-Port3000
    $runCmd = if ($PkgMgr -eq 'bun') { 'bun run dev:once' } else { 'npm run dev:once' }
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Starting app via: $runCmd (ADK + A2A on http://localhost:3000)" -ForegroundColor Cyan
    return Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', $runCmd -WorkingDirectory $AppDir -NoNewWindow -PassThru
}

function Sync-DependenciesIfNeeded {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] package.json changed -> installing updated dependencies via $PkgMgr..." -ForegroundColor Yellow
    $installCmd = if ($PkgMgr -eq 'bun') { 'bun install --backend=copyfile' } else { 'npm install' }
    $p = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', $installCmd -WorkingDirectory $AppDir -NoNewWindow -Wait -PassThru
    if ($p.ExitCode -ne 0) {
        Write-Host "[Supervisor] Warning: dependency install returned exit code $($p.ExitCode)." -ForegroundColor Red
    }
}

$baseline = Get-WatchSnapshot
Write-Host "[Supervisor] Package Manager : $PkgMgr" -ForegroundColor Green
Write-Host "[Supervisor] Watched Files   : $($baseline.FileCount) code/config files (ignoring custom_manuals.json & data/)" -ForegroundColor Green
Write-Host "[Supervisor] Initial Hash    : $($baseline.Hash.Substring(0, 16))..." -ForegroundColor DarkGray

if ($DryRun) {
    Write-Host "[Supervisor] Dry-run verification passed cleanly." -ForegroundColor Green
    exit 0
}

$serverProc = $null
try {
    $serverProc = Start-AppServer
    Write-Host "[Supervisor] Watching for app updates. Press Ctrl+C to stop cleanly." -ForegroundColor Gray

    while ($true) {
        Start-Sleep -Milliseconds 1200
        $current = Get-WatchSnapshot

        if ($current.Hash -ne $baseline.Hash) {
            Write-Host "`n[$(Get-Date -Format 'HH:mm:ss')] Update detected in application files. Waiting 1.2s for writes to settle..." -ForegroundColor Yellow
            Start-Sleep -Milliseconds 1200
            $settled = Get-WatchSnapshot
            while ($settled.Hash -ne $current.Hash) {
                $current = $settled
                Start-Sleep -Milliseconds 1000
                $settled = Get-WatchSnapshot
            }

            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Restarting server to apply update..." -ForegroundColor Yellow
            if ($null -ne $serverProc -and -not $serverProc.HasExited) {
                Stop-ProcessTree -ParentPid $serverProc.Id
            }

            if ($settled.PkgStamp -ne $baseline.PkgStamp) {
                Sync-DependenciesIfNeeded
            }

            $baseline = $settled
            $serverProc = Start-AppServer
            continue
        }

        if ($null -ne $serverProc -and $serverProc.HasExited) {
            $exitCode = $serverProc.ExitCode
            Write-Host "`n[$(Get-Date -Format 'HH:mm:ss')] App process exited (code $exitCode). Auto-restarting in 2s..." -ForegroundColor Red
            Start-Sleep -Seconds 2
            $baseline = Get-WatchSnapshot
            $serverProc = Start-AppServer
        }
    }
} finally {
    Write-Host "`n[Supervisor] Shutting down server and freeing port 3000..." -ForegroundColor Cyan
    if ($null -ne $serverProc -and -not $serverProc.HasExited) {
        Stop-ProcessTree -ParentPid $serverProc.Id
    }
    Clear-Port3000
}
