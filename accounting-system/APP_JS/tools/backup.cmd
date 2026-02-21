@echo off
chcp 65001 >nul 2>&1
echo.
echo ========================================
echo    أداة النسخ الاحتياطي - نظام المحاسبة
echo ========================================
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0backup.ps1"
