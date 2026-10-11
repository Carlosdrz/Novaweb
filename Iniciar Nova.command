#!/bin/bash
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Falta Node.js. Instalelo desde https://nodejs.org (version LTS)."; read -p "Pulse Enter"; exit 1; }
[ -d node_modules ] || { echo "Instalando piezas, espere un minuto..."; npm install; }
npx -y @anthropic-ai/claude-code auth status >/dev/null 2>&1 || npx -y @anthropic-ai/claude-code auth login
[ -n "$NOVA_PASSWORD" ] || { [ -f nova.clave ] && NOVA_PASSWORD=$(cat nova.clave); }
export NOVA_LOCAL=1; [ -n "$NOVA_PASSWORD" ] && export NOVA_PASSWORD
echo "Abriendo Nova. No cierre esta ventana mientras la use."
(sleep 4; open http://localhost:8080) &
node server.mjs
