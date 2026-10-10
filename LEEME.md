# NOVA web

Nova como aplicación web: se abre con un enlace, desde el teléfono o la computadora.
Usa su plan Claude Pro (a través de Claude Code), busca en internet y puede hablar y escuchar.

Seguridad: Nova web **no** tiene acceso a archivos, terminal ni correo. Solo conversa y busca en la web.
Se entra con contraseña. Use su plan solo para usted: no comparta el enlace ni la contraseña.

## 1. Probarla primero en su computadora (2 minutos)

Requisitos: Node 20.19 o superior (nodejs.org) y haber iniciado sesión una vez con `claude` (Claude Code).

    npm install
    NOVA_PASSWORD=unaclave123 npm start        (Mac/Linux)
    set NOVA_PASSWORD=unaclave123 && npm start  (Windows, cmd)

Abra http://localhost:8080 en Chrome o Edge, entre con esa contraseña y escríbale o pulse el micrófono.

## 2. Ponerla en internet (enlace propio, ~10 minutos)

1. Cree una cuenta gratis en github.com y un repositorio **privado** llamado `nova`. Suba esta carpeta (sin `node_modules`).
2. En su computadora, en una terminal, ejecute `claude setup-token`. Copie el token que aparece (no lo comparta).
3. Cree una cuenta en render.com → New → Blueprint → elija el repositorio `nova`.
4. Render pedirá estas variables:
   - `NOVA_PASSWORD`: la contraseña para entrar (mínimo 8 caracteres).
   - `CLAUDE_CODE_OAUTH_TOKEN`: el token del paso 2.
   - `GMAIL_USER` y `GMAIL_APP_PASSWORD`: contraseña de aplicación de Gmail (myaccount.google.com → Seguridad → Contraseñas de aplicaciones) para que Nova avise de sus correos.
   - `ELEVENLABS_API_KEY`: opcional, para la voz de ElevenLabs. Sin ella usa la voz del navegador.
5. Cuando termine verá un enlace `https://nova-xxxx.onrender.com`. Ese es su Nova web. Con https el micrófono funciona.

Render plan Starter (unos 7 USD al mes): siempre encendido y con disco, para que los recordatorios y los avisos de correo funcionen aunque no tenga la página abierta. En el plan gratis duerme y pierde los recordatorios.

## Uso

- Escriba o pulse el micrófono y hable.
- «Escucha: diga Nova»: mantenga la pestaña abierta, diga «Nova, …» y responde. Solo funciona en Chrome o Edge, con la pestaña abierta.
- «Respuestas habladas» activa o apaga la voz.
- Cada respuesta gasta uso de su plan Pro. Cambie `NOVA_MODEL` a `claude-opus-5-5` para respuestas más profundas (gasta más).

## Recordatorios, tareas diarias y correos

- «Nova, recuérdame en 10 minutos llamar a mamá», «todos los días a las 7 haz ejercicio», «de lunes a viernes a las 6 revisar agenda».
- Los avisos se dicen en voz alta con la página abierta; si estaba cerrada, se dicen al abrirla (hasta 24 h después).
- Cuando llega un correo de las dos cuentas vigiladas, Nova dice el remitente y el asunto. Nunca lee el contenido.
- Lo que le cuente de usted lo recuerda (se guarda en `/data`).
