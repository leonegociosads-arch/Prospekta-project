@echo off
REM Atalho para ligar o worker do Prospekta sem mexer no terminal do VS Code.
REM Basta dar um duplo-clique neste arquivo no Explorador de Arquivos do Windows.
REM Para PARAR o worker: feche esta janela preta (ou aperte Ctrl+C nela).

cd /d "%~dp0"
title Prospekta - worker
echo ============================================================
echo   WORKER DO PROSPEKTA
echo ============================================================
echo.
echo   Deixe esta janela ABERTA enquanto quiser processar leads.
echo   Para parar: feche esta janela.
echo.
echo ------------------------------------------------------------
echo.

call npm run worker

echo.
echo ------------------------------------------------------------
echo   O worker parou. Pode fechar esta janela.
echo ------------------------------------------------------------
pause
