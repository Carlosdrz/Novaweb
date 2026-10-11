@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo %~dp0 | findstr /i "rartemp Rar$ \\Temp\\" >nul
if not errorlevel 1 goto sinextraer
if not exist package.json goto sinextraer
if not exist server.mjs goto sinextraer
where node >nul 2>nul
if errorlevel 1 ( echo Falta instalar Node.js: https://nodejs.org ^(boton LTS^) & pause & exit /b 1 )
if not exist node_modules ( echo Instalando piezas, espere un minuto... & call npm install || ( echo Fallo la instalacion. & pause & exit /b 1 ) )
if "%NOVA_PASSWORD%"=="" set /p NOVA_PASSWORD=Elija una contrasena para entrar a Nova ^(minimo 8 caracteres^): 
echo.
echo Abriendo Nova. No cierre esta ventana mientras la use.
start "" cmd /c "timeout /t 6 >nul & start http://localhost:8080"
node server.mjs
pause
exit /b
:sinextraer
echo.
echo  PRIMERO DEBE EXTRAER EL ZIP.
echo  En el Explorador: clic derecho sobre el ZIP ^> Extraer todo...
echo  Luego abra la carpeta extraida y ejecute este archivo desde alli.
echo.
pause
