@echo off
setlocal EnableDelayedExpansion
cd /d C:\auracomex\auracomex

set LOGFILE=C:\auracomex\auracomex\supabase_push_log.txt
echo ============================================== > "%LOGFILE%"
echo Supabase db push - %DATE% %TIME% >> "%LOGFILE%"
echo ============================================== >> "%LOGFILE%"

echo ================================
echo   Supabase - Aplicar Migrations
echo ================================
echo.

call supabase db push >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    echo [FALHOU] supabase db push
) else (
    echo [OK] Migrations aplicadas com sucesso
)

echo.
echo ==== Conteudo do log ====
type "%LOGFILE%"

echo.
echo Log completo salvo em: %LOGFILE%
echo.
echo ================================
echo   FIM DO SCRIPT
echo ================================
pause
