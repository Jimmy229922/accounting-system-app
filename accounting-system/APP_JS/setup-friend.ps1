param(
    [switch]$LaunchAfter
)

$ErrorActionPreference = 'Stop'

$baseDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$installerPath = Join-Path $baseDir 'installer\Accounting System Setup 1.0.0.exe'
$seedDbPath = Join-Path $baseDir 'seed\accounting.db'

if (-not (Test-Path $installerPath)) {
    throw "Installer not found: $installerPath"
}

if (-not (Test-Path $seedDbPath)) {
    throw "Seed database not found: $seedDbPath"
}

Write-Host '[1/4] Installing Accounting System...'
Start-Process -FilePath $installerPath -Wait

Write-Host '[2/4] Detecting installed executable...'
$exeCandidates = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\Accounting System\Accounting System.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\accounting-system-desktop\Accounting System.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\accounting-system\Accounting System.exe')
)

$exePath = $exeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $exePath) {
    $programsRoot = Join-Path $env:LOCALAPPDATA 'Programs'
    if (Test-Path $programsRoot) {
        $found = Get-ChildItem -Path $programsRoot -Recurse -Filter 'Accounting System.exe' -File -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending |
            Select-Object -First 1
        if ($found) {
            $exePath = $found.FullName
        }
    }
}

if (-not $exePath) {
    throw 'Installed executable was not found after setup.'
}

Write-Host "Found executable: $exePath"

Write-Host '[3/4] Applying clean seeded database...'
$userDataDirs = @(
    (Join-Path $env:APPDATA 'accounting-system-desktop'),
    (Join-Path $env:APPDATA 'Accounting System'),
    (Join-Path $env:APPDATA 'accounting-system')
)

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
foreach ($dir in $userDataDirs) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
    $destDb = Join-Path $dir 'accounting.db'

    if (Test-Path $destDb) {
        $backupDb = Join-Path $dir "accounting.pre-seed-$timestamp.db"
        Copy-Item -Path $destDb -Destination $backupDb -Force
    }

    Copy-Item -Path $seedDbPath -Destination $destDb -Force
}

Write-Host '[4/4] Creating desktop shortcut...'
$desktopPath = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktopPath 'Accounting System.lnk'

$wsh = New-Object -ComObject WScript.Shell
$shortcut = $wsh.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $exePath
$shortcut.WorkingDirectory = Split-Path -Parent $exePath
$shortcut.Description = 'Accounting System'
$shortcut.IconLocation = "$exePath,0"
$shortcut.Save()

Write-Host ''
Write-Host 'Setup completed.'
Write-Host 'Login username: Jimmy'
Write-Host 'Login password: A7med1221'
Write-Host "Desktop shortcut: $shortcutPath"

if ($LaunchAfter) {
    Start-Process -FilePath $exePath
}
