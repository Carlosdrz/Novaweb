@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Falta Node.js. Instalelo desde https://nodejs.org ^(version LTS^) y vuelva a abrir este archivo.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Instalando piezas, espere un minuto...
  call npm install
)
if "%NOVA_PASSWORD%"=="" set /p NOVA_PASSWORD=Elija una contrasena para entrar a Nova ^(minimo 8 caracteres^): 
echo.
echo Abriendo Nova. No cierre esta ventana mientras la use.
start "" cmd /c "timeout /t 4 >nul & start http://localhost:8080"
node server.mjs
pause
