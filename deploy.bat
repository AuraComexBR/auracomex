@echo off
setlocal EnableDelayedExpansion
cd /d C:\auracomex\auracomex

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
git add -A
git commit -m "%MSG%"
git push origin main
if errorlevel 1 (
    set ERRO_GERAL=1
    set STATUS_GIT=FALHOU
) else (
    set STATUS_GIT=OK
)

echo.
echo ==== [2/3] Aplicando migrations no Supabase ====
echo (Se aparecer uma pergunta tipo "Apply migrations? [Y/n]", digite Y e Enter)
call supabase db push
if errorlevel 1 (
    set ERRO_GERAL=1
    set STATUS_DB=FALHOU
) else (
    set STATUS_DB=OK
)

echo.
echo ==== [3/3] Publicando Edge Functions no Supabase ====
call supabase functions deploy
if errorlevel 1 (
    set ERRO_GERAL=1
    set STATUS_FN=FALHOU
) else (
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
    echo Teve pelo menos um erro. Revise as mensagens acima (role pra cima no terminal).
) else (
    echo Tudo certo!
)

echo.
echo ================================
echo   FIM DO SCRIPT
echo ================================
pause
