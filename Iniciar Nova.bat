@echo off
chcp 65001 >nul
if not exist "%~dp0nova.ps1" (
  echo.
  echo  Extraiga primero el ZIP ^(clic derecho ^> Extraer todo^) y abra este archivo desde la carpeta extraida.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0nova.ps1"
