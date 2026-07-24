@echo off
setlocal EnableDelayedExpansion

if not "%1"=="RUN" (
    start "Supabase Push" cmd /k "%~f0" RUN
    exit /b
)

cd /d C:\auracomex\auracomex

set LOGFILE=%~dp0supabase_push_log.txt
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
    echo.
    echo ==== Detalhes do erro ====
    powershell -NoProfile -Command "Get-Content -Path '%LOGFILE%' -Tail 60"
) else (
    echo [OK] Migrations aplicadas com sucesso
)

echo.
echo Log completo em: %LOGFILE%
echo.
echo ================================
echo   Pressione qualquer tecla para fechar
echo ================================
pause >nul
