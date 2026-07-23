@echo off
cd /d C:\auracomex\auracomex

echo ================================
echo   Supabase - Aplicar Migrations
echo ================================
echo.

call supabase db push

echo.
echo ================================
echo   Concluido!
echo ================================
pause
