@echo off
setlocal
cd /d "%~dp0"

echo.
echo ==========================================
echo   NexusFlow - Publicar imagem Docker Hub
echo ==========================================
echo.

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\docker-release.ps1" %*
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if not "%EXIT_CODE%"=="0" (
  echo A publicacao falhou com o codigo %EXIT_CODE%.
) else (
  echo Processo concluido.
)
echo.
pause
exit /b %EXIT_CODE%

