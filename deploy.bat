@echo off
setlocal EnableDelayedExpansion
cd /d C:\auracomex\auracomex

set LOGFILE=C:\auracomex\auracomex\deploy_log.txt
echo ============================================== > "%LOGFILE%"
echo Deploy Aura Comex - %DATE% %TIME% >> "%LOGFILE%"
echo ============================================== >> "%LOGFILE%"

set ERRO_GERAL=0
set STATUS_GIT=--
set STATUS_DB=--
set STATUS_FN=--

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
call git add -A >> "%LOGFILE%" 2>&1
call git commit -m "%MSG%" >> "%LOGFILE%" 2>&1
call git push origin main >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    echo [FALHOU] git push
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
    echo [FALHOU] supabase db push
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
    echo [FALHOU] supabase functions deploy
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
echo Log completo salvo em:
echo %LOGFILE%
echo.

if !ERRO_GERAL! EQU 1 (
    echo ==== Ultimas linhas do log (onde provavelmente esta o erro) ====
    type "%LOGFILE%"
)

echo.
echo ================================
echo   FIM DO SCRIPT
echo ================================
pause
