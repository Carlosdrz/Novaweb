# Nova: seguridad y estado real de las funciones

Este documento solo afirma lo que está implementado y probado. Ningún sistema evaluado así está "completamente seguro".

## Qué hay y cómo se verificó

| Requisito | Estado | Cómo se comprobó |
|---|---|---|
| Permisos granulares | Hecho. Cada capacidad tiene su interruptor (Herramientas) y se revisa en cada llamada. Lo del equipo viene apagado. | `test/seguridad.test.mjs` + `test/e2e.mjs` con Claude real |
| Confirmación antes de actuar | Hecho: abrir páginas, crear archivos y borrar notas/tareas piden un «Permitir» en pantalla. Sin respuesta en 90 s, o al detener, se deniega. | Pruebas unitarias, e2e y prueba visual del cuadro |
| Claves protegidas | Hecho: viven en variables de entorno del servidor; la página nunca las recibe. `nova.clave` y `data/` están fuera de Git. | Revisión de código |
| Historial de acciones | Hecho: `data/actividad.jsonl`, visible en Herramientas. «Detener» (o Esc) corta la respuesta y deniega confirmaciones pendientes. | Pruebas |
| Privacidad del micrófono | Hecho: indicador visible, interruptor de escucha activa, y al apagarlo se liberan las pistas del micrófono. | Revisión de código (el micrófono real no se pudo probar en la nube) |
| Instrucciones maliciosas | Parcial pero verificado: el contenido de archivos y páginas se marca como datos no confiables y, aunque el modelo obedeciera, las acciones sensibles piden confirmación. | e2e: un archivo con una orden oculta no abrió nada |
| Límites del equipo | Hecho: sin ejecución de comandos, sin borrar archivos, solo carpetas autorizadas (se resuelven enlaces simbólicos y `..`), se bloquean credenciales (`.env`, claves, etc.), lectura máx. 300 KB. | Pruebas unitarias |
| Aislamiento de código generado | No aplica todavía: Nova no ejecuta código generado. | — |
| Servidor local | En modo local solo escucha en 127.0.0.1; las peticiones que cambian algo rechazan orígenes ajenos. | e2e |

## Varias IAs combinadas (consejo)

Para preguntas importantes, Nova consulta en paralelo a: un investigador (Claude + web, con fuentes), un analista, un verificador de riesgos, Wikipedia y, si el servidor tiene `OPENAI_API_KEY` y/o `GEMINI_API_KEY`, OpenAI y Gemini. Cada fuente puede fallar sin afectar a las demás. Nova trata esos borradores como datos no confiables, los contrasta y da una sola respuesta. Se activa o apaga en Herramientas («Consejo de IAs»); gasta más del plan de Claude.
Verificado: pruebas unitarias con servicios simulados (Wikipedia, Open-Meteo, OpenAI, Gemini) y una prueba real con Claude. OpenAI y Gemini reales no se probaron (no hay claves).

## Pendiente (no se afirma que exista)

- Proveedor principal intercambiable (hoy el cerebro es Claude; OpenAI/Gemini participan solo como consejeros).
- Visión por computadora (imágenes/capturas), búsqueda semántica en documentos propios, modo sin conexión.
- Reglas «cuando ocurra X, haz Y» (hoy: recordatorios y rutinas diarias).
- Sistema de extensiones con manifiesto (hoy: herramientas internas con permiso, límites y registro).
- Hogar inteligente: probado solo contra un simulador de Home Assistant, no contra uno real.
- Voz de ElevenLabs y alertas de Gmail: necesitan sus claves; sin ellas usan la voz del navegador / están desactivadas.
- Pruebas de seguridad externas y empaquetado como instalador de Windows.

## Qué necesita cada función

- Internet: chat con Claude, búsqueda web, noticias, voz ElevenLabs, Gmail.
- Cuenta/clave: sesión de Claude (suscripción), ElevenLabs (clave), Gmail (contraseña de aplicación), Home Assistant (URL y token).
- Solo al ejecutar Nova en su computadora (`NOVA_LOCAL=1`, lo pone el lanzador): abrir páginas y aplicaciones, buscar/leer/crear archivos.

## Pruebas

```
npm test          # pruebas unitarias (sin Claude)
npm run e2e       # prueba real contra Claude (necesita sesión)
```
