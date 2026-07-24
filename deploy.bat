@echo off
setlocal EnableDelayedExpansion

REM Garante que a janela nunca feche sozinha, nao importa como foi aberta
REM (clique duplo, atalho, ou de dentro do PowerShell).
if not "%1"=="RUN" (
    start "Deploy Aura Comex" cmd /k "%~f0" RUN
    exit /b
)

cd /d C:\auracomex\auracomex

set LOGFILE=%~dp0deploy_log.txt
echo ============================================== > "%LOGFILE%"
echo Deploy Aura Comex - %DATE% %TIME% >> "%LOGFILE%"
echo ============================================== >> "%LOGFILE%"

set ERRO_GERAL=0

echo ================================
echo   Deploy Aura Comex
echo ================================
echo.

git status
echo.

set /p MSG="Mensagem do commit (Enter para usar 'Deploy'): "
if "%MSG%"=="" set MSG=Deploy

echo.
echo ==== [1/3] Enviando codigo (git) ====
git add -A >> "%LOGFILE%" 2>&1
git commit -m "%MSG%" >> "%LOGFILE%" 2>&1
git push origin main >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    echo [FALHOU] git push - veja detalhes abaixo
    set ERRO_GERAL=1
    set STATUS_GIT=FALHOU
) else (
    echo [OK] Codigo enviado
    set STATUS_GIT=OK
)

echo.
echo ==== [2/3] Aplicando migrations no Supabase ====
call supabase db push >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    echo [FALHOU] supabase db push - veja detalhes abaixo
    set ERRO_GERAL=1
    set STATUS_DB=FALHOU
) else (
    echo [OK] Migrations aplicadas
    set STATUS_DB=OK
)

echo.
echo ==== [3/3] Publicando Edge Functions no Supabase ====
call supabase functions deploy >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    echo [FALHOU] supabase functions deploy - veja detalhes abaixo
    set ERRO_GERAL=1
    set STATUS_FN=FALHOU
) else (
    echo [OK] Functions publicadas
    set STATUS_FN=OK
)

echo.
echo ================================
echo   RELATORIO FINAL
echo ================================
echo Codigo (git push):        !STATUS_GIT!
echo Migrations (db push):     !STATUS_DB!
echo Edge Functions:           !STATUS_FN!
echo.

if !ERRO_GERAL! EQU 1 (
    echo Teve pelo menos um erro. O log completo esta em:
    echo %LOGFILE%
    echo.
    echo ==== Ultimas linhas do log ====
    powershell -NoProfile -Command "Get-Content -Path '%LOGFILE%' -Tail 40"
) else (
    echo Tudo certo! Log completo em: %LOGFILE%
)

echo.
echo ================================
echo   Pressione qualquer tecla para fechar
echo ================================
pause >nul
