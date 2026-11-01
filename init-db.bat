@echo off
TITLE Crumb ^& Co. Database Initializer (PostgreSQL bakery_db)

echo ==============================================================
echo        CRUMB ^& CO. POSTGRESQL DATABASE INITIALIZER
echo ==============================================================
echo Target Database : bakery_db
echo Host            : localhost:5432
echo User            : postgres
echo ==============================================================
echo.
echo Initializing schema and seeding realistic dataset...
cd /d "%~dp0backend"
node init_postgres_db.js

echo.
echo ==============================================================
echo Database setup routine complete.
echo ==============================================================
echo.
pause
