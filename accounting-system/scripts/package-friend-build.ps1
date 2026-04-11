$ErrorActionPreference = 'Stop'
Set-Location -Path "d:\JS\accounting-system\frontend-desktop"

Write-Host "Building Application..."
npm run build

if ($?) {
    Write-Host "Build finished. Creating APP_JS folder..."
    
    # Ensure clean directory
    if (Test-Path "dist\APP_JS") {
        Remove-Item -Recurse -Force "dist\APP_JS"
    }
    if (Test-Path "dist\APP_JS.zip") {
        Remove-Item -Force "dist\APP_JS.zip"
    }

    New-Item -ItemType Directory -Force -Path "dist\APP_JS" | Out-Null
    
    Write-Host "Copying Setup executable..."
    # Copy only the installer executable, usually named something like "Accounting System Setup x.x.x.exe"
    Copy-Item -Path "dist\*.exe" -Destination "dist\APP_JS\" -Exclude "*unpacked*" -ErrorAction Continue

    Write-Host "Compressing to APP_JS.zip..."
    Compress-Archive -Path "dist\APP_JS" -DestinationPath "dist\APP_JS.zip" -Force
    
    Write-Host "`n✅ Build Packaged Successfully! You can find it at: frontend-desktop\dist\APP_JS.zip"
} else {
    Write-Host "`n❌ Build Failed!"
}
