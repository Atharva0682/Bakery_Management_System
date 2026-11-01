# Crumb & Co. Bakery Management System Launcher (PowerShell)
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

Write-Host "==============================================================================" -ForegroundColor Yellow
Write-Host "       CRUMB & CO. ARTISANAL BAKERY MANAGEMENT SYSTEM (BANDRA WEST)" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "Starting Backend API Server on Port 5000..." -ForegroundColor Green
Start-Process cmd -ArgumentList "/k cd /d `"$ScriptDir\backend`" && npm start"

Start-Sleep -Seconds 3

Write-Host "Starting Frontend React PWA Application on Port 5173..." -ForegroundColor Green
Start-Process cmd -ArgumentList "/k cd /d `"$ScriptDir\frontend`" && npm run dev"

Write-Host ""
Write-Host "==============================================================================" -ForegroundColor Yellow
Write-Host "Systems Initialized Successfully!" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Customer Storefront:      http://localhost:5173/"
Write-Host "  Staff Floor PWA:          http://localhost:5173/staff/login"
Write-Host "  Owner Operations Portal:  http://localhost:5173/owner/login"
Write-Host "  Backend REST API:         http://localhost:5000/api/health"
Write-Host ""
Write-Host "Default Accounts:"
Write-Host "  Owner:    owner@crumbco.com     / Password@123"
Write-Host "  Baker:    baker@crumbco.com     / Password@123"
Write-Host "  Customer: customer@crumbco.com  / Password@123 (or Guest - no login required)"
Write-Host "==============================================================================" -ForegroundColor Yellow
