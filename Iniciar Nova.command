#!/bin/bash
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Falta Node.js. Instalelo desde https://nodejs.org (version LTS)."; read -p "Pulse Enter"; exit 1; }
[ -d node_modules ] || { echo "Instalando piezas, espere un minuto..."; npm install; }
[ -n "$NOVA_PASSWORD" ] || read -p "Elija una contrasena para entrar a Nova (minimo 8 caracteres): " NOVA_PASSWORD
export NOVA_PASSWORD
echo "Abriendo Nova. No cierre esta ventana mientras la use."
(sleep 4; open http://localhost:8080) &
node server.mjs
