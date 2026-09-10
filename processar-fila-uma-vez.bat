@echo off
REM Processa TUDO que esta na fila e para sozinho (nao fica esperando).
REM Duplo-clique neste arquivo no Explorador de Arquivos do Windows.

cd /d "%~dp0"
title Prospekta - processar fila (uma vez)
echo ============================================================
echo   PROSPEKTA - processando a fila uma vez
echo ============================================================
echo.

call npm run worker:once

echo.
echo ------------------------------------------------------------
echo   Terminou. Atualize a pagina da pesquisa no site.
echo   Pode fechar esta janela.
echo ------------------------------------------------------------
pause
