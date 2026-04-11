$ErrorActionPreference = "Stop"

$root = Split-Path -Path $PSScriptRoot -Parent
$launcherPath = Join-Path $root "scripts\launch-desktop-full.vbs"
$wscriptPath = Join-Path $env:WINDIR "System32\wscript.exe"
$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktopPath "Accounting System.lnk"
$legacyShortcutPath = Join-Path $desktopPath "Accounting System (Dev).lnk"

if (-not (Test-Path $launcherPath)) {
    throw "Launcher not found at: $launcherPath"
}

if (-not (Test-Path $wscriptPath)) {
    throw "wscript.exe not found at: $wscriptPath"
}

$iconInstalled = Join-Path $env:LOCALAPPDATA "Programs\accounting-system\Accounting System.exe"
$iconPrimary = Join-Path $root "frontend-desktop\dist\win-unpacked\Accounting System.exe"
$iconSecondary = Join-Path $root "frontend-desktop\node_modules\electron\dist\electron.exe"
$iconFallback = Join-Path $root "node_modules\electron\dist\electron.exe"
$iconPath = if (Test-Path $iconInstalled) { $iconInstalled } elseif (Test-Path $iconPrimary) { $iconPrimary } elseif (Test-Path $iconSecondary) { $iconSecondary } elseif (Test-Path $iconFallback) { $iconFallback } else { "" }

$wshShell = New-Object -ComObject WScript.Shell
$shortcut = $wshShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $wscriptPath
$shortcut.Arguments = "`"$launcherPath`""
$shortcut.WorkingDirectory = $root
$shortcut.Description = "Run Accounting System (auto-updated launcher)"

if ($iconPath) {
    $shortcut.IconLocation = "$iconPath,0"
}

$shortcut.Save()
if (Test-Path $legacyShortcutPath) {
    Remove-Item -Path $legacyShortcutPath -Force
}
Write-Output "Shortcut created: $shortcutPath"
