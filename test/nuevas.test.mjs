import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const base = mkdtempSync(join(tmpdir(), 'nova-n-'))
process.env.NOVA_DATA_DIR = join(base, 'data'); process.env.NOVA_LOCAL = '1'
const seg = await import('../seguridad.mjs')
const { buscarMedios, intencionVisual } = await import('../medios.mjs')
const B = await import('../busquedas.mjs'), PR = await import('../programadas.mjs'), PJ = await import('../proyectos.mjs')

test('detecta peticiones visuales', () => {
  assert.deepEqual(intencionVisual('Busca una imagen de un agujero negro'), { tipo: 'imagen', q: 'agujero negro' })
  assert.equal(intencionVisual('Enséñame un video de cómo funciona un motor eléctrico').tipo, 'video')
  assert.equal(intencionVisual('¿Cuánto es 2 más 2?'), null)
  assert.equal(intencionVisual('explícame qué es una imagen digital'), null)
})
test('medios: resultados por fuente en cuanto llegan, con licencia', async () => {
  const srv = http.createServer((q, r) => { r.setHeader('content-type', 'application/json')
    if (q.url.startsWith('/w/api.php')) return r.end(JSON.stringify({ query: { pages: { 1: { index: 1, title: 'Archivo:Black hole.jpg', imageinfo: [{ thumburl: 'https://x/t.jpg', url: 'https://x/f.jpg', descriptionurl: 'https://x/p', extmetadata: { LicenseShortName: { value: 'CC BY-SA 4.0' }, Artist: { value: '<b>NASA</b>' } } }] } } } }))
    if (q.url.startsWith('/v1/images')) return r.end(JSON.stringify({ results: [{ title: 'Agujero', thumbnail: 'https://o/t.jpg', url: 'https://o/f.jpg', foreign_landing_url: 'https://o/p', license: 'by', license_version: '4.0', creator: 'Ana' }] }))
    r.statusCode = 500; r.end('{}') })
  await new Promise((ok) => srv.listen(0, ok)); const u = `http://127.0.0.1:${srv.address().port}`
  process.env.COMMONS_BASE = u; process.env.OPENVERSE_BASE = u
  const fuentes = []; const r = await buscarMedios('imagen', 'agujero negro', (f, it) => fuentes.push([f, it.length]))
  assert.equal(r.total, 2); assert.equal(r.estado, 'ok'); assert.equal(fuentes.length, 2)
  let items; await buscarMedios('imagen', 'xx', (f, it) => { if (f === 'Wikimedia Commons') items = it })
  assert.equal(items[0].autor, 'NASA'); assert.equal(items[0].licencia, 'CC BY-SA 4.0'); assert.equal(items[0].titulo, 'Black hole')
  const v = await buscarMedios('video', 'motor eléctrico', () => {}); assert.ok(v.estado) // sin YouTube: enlace de respaldo
  process.env.COMMONS_BASE = 'http://127.0.0.1:1'; process.env.OPENVERSE_BASE = 'http://127.0.0.1:1'
  const mal = await buscarMedios('imagen', 'zzz', () => {}); assert.equal(mal.estado, 'error'); assert.equal(mal.total, 0)
  srv.closeAllConnections?.(); srv.close()
})
test('historial de búsquedas: guardar, filtrar, vincular, borrar', () => {
  const a = B.registrarBusqueda({ q: 'agujero negro', tipo: 'imagen', fuentes: ['Openverse'], resultados: [{ tipo: 'imagen', titulo: 't', thumb: 'https://o/t.jpg' }] })
  B.registrarBusqueda({ q: 'motores', tipo: 'video', estado: 'error', error: 'caído' })
  assert.equal(B.listarBusquedas({ tipo: 'imagen' }).length, 1); assert.equal(B.listarBusquedas({ q: 'motor' })[0].estado, 'error')
  assert.equal(B.obtenerBusqueda(a.id).resultados.length, 1); assert.ok(B.vincularBusqueda(a.id, 'abcd1234'))
  assert.equal(B.listarBusquedas({ proyecto: 'abcd1234' }).length, 1); assert.equal(B.borrarBusqueda(a.id), 1); assert.equal(B.limpiarBusquedas(), 1)
})
test('tareas programadas: ejecuta, repite, pausa, omite vencidas y registra errores', async () => {
  const t0 = Date.now(); const ran = []
  const t = PR.crearProgramada({ titulo: 'Agenda', at: t0 + 60000, repeat: 'daily' })
  await PR.tick(async (x) => { ran.push(x.id) }, t0); assert.equal(ran.length, 0)
  await PR.tick(async (x) => { ran.push(x.id) }, t0 + 61000); assert.equal(ran.length, 1)
  const s = PR.listarProgramadas().find((x) => x.id === t.id); assert.ok(s.at > t0 + 61000 && s.activo); assert.equal(s.runs[0].estado, 'ok')
  PR.editarProgramada(t.id, { activo: false }); await PR.tick(async () => ran.push('x'), t0 + 3 * 86400000); assert.equal(ran.length, 1)
  const u = PR.crearProgramada({ titulo: 'Una vez', at: t0 + 1000 }); await PR.tick(async () => { throw new Error('sin red') }, t0 + 2000)
  const e = PR.listarProgramadas().find((x) => x.id === u.id); assert.equal(e.estado, 'error'); assert.equal(e.activo, false); assert.match(e.runs[0].detalle, /sin red/)
  const w = PR.crearProgramada({ titulo: 'Vieja', at: t0 + 5000 }); await PR.tick(async () => ran.push('v'), t0 + 3 * 86400000)
  assert.equal(PR.listarProgramadas().find((x) => x.id === w.id).runs[0].estado, 'omitida')
  assert.throws(() => PR.crearProgramada({ titulo: 'x', tipo: 'consulta', at: t0 + 9999 }), /instrucción/); assert.throws(() => PR.crearProgramada({ titulo: 'x', at: t0 - 999999 }), /pasó/)
  assert.equal(PR.borrarProgramada(t.id), 1)
})
test('proyectos: objetivos, archivos vinculados dentro de la carpeta autorizada, aislamiento y archivos perdidos', () => {
  const carpeta = join(base, 'docs'); mkdirSync(carpeta); writeFileSync(join(carpeta, 'notas.md'), 'Ley de Newton: F = m a\nsegunda línea'); writeFileSync(join(carpeta, 'tabla.pdf'), '%PDF')
  mkdirSync(join(base, 'fuera')); writeFileSync(join(base, 'fuera', 'secreto.txt'), 'no')
  seg.guardarAjustes({ carpetas: [carpeta], permisos: { leerArchivos: true } })
  const p = PJ.crearProyecto({ nombre: 'Física', descripcion: 'Estudio' }), q = PJ.crearProyecto({ nombre: 'Otro' })
  PJ.agregarObjetivo(p.id, 'Repasar Newton'); PJ.agregarNotaProyecto(p.id, 'Examen el viernes')
  PJ.vincularArchivo(p.id, join(carpeta, 'notas.md')); PJ.vincularArchivo(p.id, join(carpeta, 'tabla.pdf'))
  assert.throws(() => PJ.vincularArchivo(p.id, join(base, 'fuera', 'secreto.txt')), /fuera de las carpetas/)
  assert.match(PJ.leerArchivoProyecto(p.id, 'notas.md').texto, /Newton/); assert.throws(() => PJ.leerArchivoProyecto(p.id, 'tabla.pdf'), /solo texto|No sé leer/)
  assert.ok(PJ.buscarEnProyecto(p.id, 'newton')[0].includes('notas.md:1')); assert.throws(() => PJ.leerArchivoProyecto(q.id, 'notas.md'), /no está vinculado/)
  assert.match(PJ.contextoProyecto(p.id), /Física/); assert.ok(!PJ.contextoProyecto(p.id).includes('Otro'))
  const ctxQ = PJ.contextoProyecto(q.id); assert.ok(!ctxQ.includes('Newton') && !ctxQ.includes('viernes'))
  writeFileSync(join(carpeta, 'borrar.txt'), 'x'); PJ.vincularArchivo(p.id, join(carpeta, 'borrar.txt')); import('node:fs').then(({ unlinkSync }) => unlinkSync(join(carpeta, 'borrar.txt')))
})
test('proyecto: archivo movido se marca no disponible', async () => {
  const { unlinkSync } = await import('node:fs'); const p = PJ.listarProyectos().find((x) => x.nombre === 'Física')
  await new Promise((r) => setTimeout(r, 50)); const full = PJ.obtenerProyecto(p.id); const a = full.archivos.find((x) => x.nombre === 'borrar.txt')
  assert.equal(a.disponible, false); assert.match(a.motivo, /ya no está/)
})

test('vía rápida: transmite Gemini y cae a ChatGPT si falla', async () => {
  const F = await import('../fuentes.mjs')
  const srv = http.createServer((q, r) => {
    if (q.url.includes('streamGenerateContent')) { r.statusCode = 500; return r.end('x') }
    r.setHeader('content-type', 'text/event-stream')
    r.write('data: ' + JSON.stringify({ choices: [{ delta: { content: 'Hola ' } }] }) + '\n\n'); r.write('data: ' + JSON.stringify({ choices: [{ delta: { content: 'Señor.' } }] }) + '\n\ndata: [DONE]\n\n'); r.end()
  })
  await new Promise((ok) => srv.listen(0, ok)); const u = `http://127.0.0.1:${srv.address().port}`
  Object.assign(process.env, { GEMINI_API_KEY: 'g', OPENAI_API_KEY: 'o', GEMINI_BASE_URL: u, OPENAI_BASE_URL: u })
  assert.ok(F.hayRapida()); let txt = ''
  const via = await F.respuestaRapida([{ role: 'user', content: 'hola' }], (t) => { txt += t })
  assert.equal(via, 'ChatGPT'); assert.equal(txt, 'Hola Señor.')
  srv.closeAllConnections?.(); srv.close()
})

test('selector de voces: sin clave lista opciones; con clave prueba y valida el id', async () => {
  const { manejarApi2 } = await import('../api2.mjs')
  const mk = (method, path, bodyObj) => { const out = { code: 0, data: null }; const res = { writeHead(c) { out.code = c }, end(b) { out.raw = b }, on() {} }; const json = (r, c, d) => { out.code = c; out.data = d }; return { out, run: () => manejarApi2({ method }, res, new URL('http://x' + path), { json, body: async () => bodyObj, runner: null }) } }
  delete process.env.ELEVENLABS_API_KEY
  let t = mk('GET', '/api/voces'); await t.run(); assert.equal(t.out.data.tieneClave, false); assert.equal(t.out.data.opciones.length, 4)
  t = mk('POST', '/api/voces/probar', { id: 'abc' }); await t.run(); assert.equal(t.out.code, 400)
  process.env.ELEVENLABS_API_KEY = 'k'; t = mk('POST', '/api/voces/probar', { id: '../etc' }); await t.run(); assert.equal(t.out.code, 400)
  delete process.env.ELEVENLABS_API_KEY
})
