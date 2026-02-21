@echo off
chcp 65001 >nul 2>&1
echo.
echo ========================================
echo    أداة الاستعادة - نظام المحاسبة
echo ========================================
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0restore.ps1"
