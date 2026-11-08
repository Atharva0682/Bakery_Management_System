@echo off
TITLE Crumb ^& Co. Artisanal Bakery Management System Launcher
cd /d "%~dp0"
node start.js
if %errorlevel% neq 0 (
  echo.
  echo Server stopped or encountered an error.
  pause
)
