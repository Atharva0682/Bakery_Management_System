@echo off         
TITLE Crumb ^& Co. Bakery Management System Launcher
echo ==============================================================================
echo        CRUMB ^& CO. ARTISANAL BAKERY MANAGEMENT SYSTEM (BANDRA WEST)
echo ==============================================================================
echo.


echo Starting Backend API Server on Port 5000...
pushd "%~dp0backend"
start "CrumbCo Backend API (Port 5000)" cmd /k "npm start"
popd


echo Waiting 3 seconds for Backend initialization...
timeout /t 3 /nobreak>nul


echo Starting Frontend React PWA Application on Port 5173...
pushd "%~dp0frontend"
start "CrumbCo Frontend PWA (Port 5173)" cmd /k "npm run dev"
popd
echo.


echo ==============================================================================
echo Systems Initialized Successfully!
echo.


echo   Customer Storefront:      http://localhost:5173/
echo   Staff Floor PWA:          http://localhost:5173/staff/login
echo   Owner Operations Portal:  http://localhost:5173/owner/login
echo   Backend REST API:         http://localhost:5000/api/health
echo.


echo   Default Accounts:          
echo   Owner:    owner@crumbco.com     / Password@123
echo   Baker:    baker@crumbco.com     / Password@123
echo   Customer: customer@crumbco.com  / Password@123 (or Guest - no login required)
echo ==============================================================================
pause