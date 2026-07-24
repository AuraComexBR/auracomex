@echo off
setlocal EnableDelayedExpansion
cd /d C:\auracomex\auracomex

echo ================================
echo   Supabase - Aplicar Migrations
echo ================================
echo.
echo (Se aparecer uma pergunta tipo "Apply migrations? [Y/n]", digite Y e Enter)
echo.

call supabase db push
if errorlevel 1 (
    echo.
    echo [FALHOU] supabase db push - revise as mensagens acima
) else (
    echo.
    echo [OK] Migrations aplicadas com sucesso
)

echo.
echo ================================
echo   FIM DO SCRIPT
echo ================================
pause
