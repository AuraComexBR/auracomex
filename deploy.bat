@echo off
cd /d C:\auracomex\auracomex

echo ================================
echo   Deploy Aura Comex
echo ================================
echo.

git status
echo.

set /p MSG="Mensagem do commit (Enter para usar 'Deploy'): "
if "%MSG%"=="" set MSG=Deploy

echo.
echo ==== Enviando codigo (git) ====
git add -A
git commit -m "%MSG%"
git push origin main

echo.
echo ==== Aplicando migrations no Supabase (se houver) ====
call supabase db push

echo.
echo ================================
echo   Deploy concluido!
echo ================================
pause
