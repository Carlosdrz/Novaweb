# Lanzador de Nova (Windows): actualiza, instala, inicia sesion de Claude y abre Nova.
$ErrorActionPreference = 'Continue'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $dir
function Fin($m) { Write-Host ""; Write-Host $m -ForegroundColor Yellow; Read-Host "Pulse Enter para cerrar" | Out-Null; exit 1 }

if ($dir -match 'Rar\$|rartemp|\\Temp\\' -or -not (Test-Path "$dir\server.mjs")) {
  Fin "PRIMERO DEBE EXTRAER EL ZIP: clic derecho sobre el ZIP > Extraer todo... y abra la carpeta extraida."
}

# 1) Node.js (se instala solo si falta o es antiguo)
function NodeOk { try { $v = (node -v) -replace 'v',''; $p = $v.Split('.'); return ([int]$p[0] -gt 20 -or ([int]$p[0] -eq 20 -and [int]$p[1] -ge 19)) } catch { return $false } }
if (-not (NodeOk)) {
  Write-Host "Instalando Node.js, espere..." -ForegroundColor Cyan
  winget install -e --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements | Out-Null
  $env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
  if (-not (NodeOk)) { Fin "No pude instalar Node.js solo. Instalelo desde https://nodejs.org (boton LTS) y abra Nova de nuevo." }
}

# 2) Actualizacion automatica desde GitHub (conserva su clave y sus datos)
try {
  Write-Host "Buscando mejoras de Nova..." -ForegroundColor DarkCyan
  $tmp = Join-Path $env:TEMP ("nova_" + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory $tmp | Out-Null
  Invoke-WebRequest 'https://github.com/Carlosdrz/Novaweb/archive/refs/heads/main.zip' -OutFile "$tmp\n.zip" -UseBasicParsing -TimeoutSec 40
  Expand-Archive "$tmp\n.zip" -DestinationPath $tmp -Force
  $src = Join-Path $tmp 'Novaweb-main'
  robocopy $src $dir /E /XD node_modules data .git /XF nova.clave "Iniciar Nova.bat" /NFL /NDL /NJH /NJS /NP | Out-Null
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
} catch { Write-Host "(sin conexion para actualizar; sigo con lo instalado)" -ForegroundColor DarkGray }

# 3) Piezas
Write-Host "Preparando piezas..." -ForegroundColor DarkCyan
npm install --no-audit --no-fund --loglevel=error
if ($LASTEXITCODE -ne 0) { Fin "Fallo la instalacion de piezas. Revise su conexion a internet." }

# 4) Contrasena (se guarda solo en este equipo)
if (-not $env:NOVA_PASSWORD) {
  if (Test-Path "$dir\nova.clave") { $env:NOVA_PASSWORD = (Get-Content "$dir\nova.clave" -Raw).Trim() }
  else {
    $env:NOVA_PASSWORD = Read-Host "Elija una contrasena para entrar a Nova (minimo 8 caracteres)"
    Set-Content "$dir\nova.clave" $env:NOVA_PASSWORD
  }
}

# 5) Abrir el navegador cuando el servidor responda
Start-Job -ScriptBlock {
  for ($i = 0; $i -lt 90; $i++) {
    try { Invoke-WebRequest 'http://localhost:8080/api/ping' -UseBasicParsing -TimeoutSec 2 | Out-Null } catch {
      if ($_.Exception.Response) { Start-Process 'http://localhost:8080'; break }
    }
    Start-Sleep 1
  }
} | Out-Null

Write-Host "`nNova arrancando. No cierre esta ventana mientras la use.`n" -ForegroundColor Green
node server.mjs
Fin "Nova se detuvo. Revise el mensaje de arriba."
