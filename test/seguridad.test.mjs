import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync, symlinkSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const base = mkdtempSync(join(tmpdir(), 'nova-t-'))
process.env.NOVA_DATA_DIR = join(base, 'data'); process.env.NOVA_TEST_NOSPAWN = '1'
const S = await import('../seguridad.mjs'), E = await import('../equipo.mjs'), N = await import('../notas.mjs'), A = await import('../agenda.mjs'), C = await import('../conversaciones.mjs')

const permitida = join(base, 'docs'); mkdirSync(permitida)
writeFileSync(join(permitida, 'plan.txt'), 'hola'); writeFileSync(join(permitida, '.env'), 'SECRETO=1'); writeFileSync(join(base, 'fuera.txt'), 'no')
symlinkSync(join(base, 'fuera.txt'), join(permitida, 'enlace.txt'))

test('permisos: por defecto el equipo está apagado y se activa solo lo que el usuario decide', () => {
  const a = S.ajustes(); assert.equal(a.permisos.abrirApps, false); assert.equal(a.permisos.leerArchivos, false); assert.equal(a.permisos.memoria, true)
  S.guardarAjustes({ permisos: { leerArchivos: true, buscarArchivos: true, abrirUrls: true, abrirApps: true, crearArchivos: true }, carpetas: [permitida, join(base, 'no-existe')], apps: ['calculadora', 'inventada'] })
  const b = S.ajustes(); assert.equal(b.permisos.leerArchivos, true); assert.deepEqual(b.carpetas, [permitida])
  assert.ok(!b.apps.includes('inventada'))
})
test('permisos: valores no booleanos o claves desconocidas se ignoran', () => {
  S.guardarAjustes({ permisos: { casa: 'si', hackeo: true } }); assert.equal(S.ajustes().permisos.casa, false); assert.equal(S.ajustes().permisos.hackeo, undefined)
})
test('archivos: lee dentro de la carpeta autorizada', () => assert.equal(E.leerArchivo(join(permitida, 'plan.txt')), 'hola'))
test('archivos: bloquea .., rutas fuera, enlaces simbólicos y credenciales', () => {
  assert.throws(() => E.leerArchivo(join(permitida, '..', 'fuera.txt')), /fuera de las carpetas/)
  assert.throws(() => E.leerArchivo(join(permitida, 'enlace.txt')), /fuera de las carpetas/)
  assert.throws(() => E.leerArchivo(join(permitida, '.env')), /credenciales/)
  assert.throws(() => E.leerArchivo('/etc/passwd'), /fuera de las carpetas/)
})
test('archivos: la búsqueda se queda dentro de las carpetas y no sigue enlaces', () => {
  const r = E.buscarArchivos('plan'); assert.equal(r.length, 1); assert.ok(r[0].startsWith(permitida))
  assert.equal(E.buscarArchivos('enlace').length, 0)
})
test('crear archivo: solo en la carpeta de Nova, nunca sobrescribe, sanea el nombre', () => {
  const p1 = E.crearArchivo('../../evil.txt', 'a'), p2 = E.crearArchivo('../../evil.txt', 'b')
  assert.ok(p1.startsWith(E.carpetaDocs())); assert.notEqual(p1, p2); assert.equal(readFileSync(p1, 'utf8'), 'a')
  assert.throws(() => E.crearArchivo('x.exe', 'a'), /solo creo/)
})
test('abrir url: solo http(s) y sin shell', async () => {
  await E.abrirUrl('https://example.com/?a=1&b=2'); assert.ok(E.lanzados.at(-1).at(-1).startsWith('https://example.com'))
  await assert.rejects(async () => E.abrirUrl('file:///etc/passwd'), /http/); await assert.rejects(async () => E.abrirUrl('javascript:alert(1)'), /http|Invalid/)
})
test('abrir app: solo las autorizadas', async () => {
  await E.abrirApp('calculadora'); assert.ok(E.lanzados.length >= 2)
  await assert.rejects(async () => E.abrirApp('powershell'), /no está en la lista/)
})
test('confirmación: aprobar, denegar, expirar y cancelar', async () => {
  const eventos = []; const ac = new AbortController()
  const run = (ms) => S.ctx.run({ send: (e) => eventos.push(e), ac }, () => S.confirmar({ titulo: 'T', detalle: 'D' }, ms))
  let p = run(5000); assert.equal(eventos.at(-1).t, 'confirm'); assert.ok(S.responderConfirmacion(eventos.at(-1).id, true)); assert.equal(await p, true)
  p = run(5000); S.responderConfirmacion(eventos.at(-1).id, false); assert.equal(await p, false)
  assert.equal(await run(30), false)               // sin respuesta = denegado
  const ac2 = new AbortController(); const p2 = S.ctx.run({ send: (e) => eventos.push(e), ac: ac2 }, () => S.confirmar({ titulo: 'T', detalle: 'D' })); ac2.abort(); assert.equal(await p2, false)
  assert.equal(await S.confirmar({ titulo: 'x', detalle: 'y' }), false)   // sin contexto de pantalla = denegado
  assert.equal(S.hayPendientes(), 0)
})
test('historial: registra confirmaciones y acciones', () => assert.ok(S.actividad().some((x) => x.accion === 'confirmación' && x.resultado === 'aprobada')))
test('memoria: no guarda información sensible sola, sí si el usuario lo escribe en Memoria', () => {
  assert.throws(() => A.rememberFact('Mi contraseña del banco es 1234'), /sensible/); assert.throws(() => A.rememberFact('Tarjeta 4111111111111111'), /sensible/)
  assert.equal(A.rememberFact('Es alérgico a las nueces').duplicate, false)
  A.editFact(0, 'Es alérgico a los mariscos'); assert.match(A.listFacts()[0], /mariscos/); A.deleteFactAt(0); assert.equal(A.listFacts().length, 0)
  A.rememberFact('Dato manual', { manual: true }); S.guardarAjustes({ permisos: { memoria: false } }); assert.equal(A.memoryForPrompt(), ''); S.guardarAjustes({ permisos: { memoria: true } })
})
test('notas y tareas: ciclo completo', () => {
  const n = N.agregarNota('comprar leche', 'compras'); assert.equal(N.listarNotas().length, 1); assert.equal(N.borrarNota(n.id).length, 1)
  const t = N.agregarTarea('llamar al banco', 'viernes'); N.cambiarTarea('banco', true); assert.equal(N.listarTareas()[0].hecha, true); N.borrarTarea(t.id); assert.equal(N.listarTareas().length, 0)
  assert.throws(() => N.agregarNota('   '), /vacía/)
})
test('conversaciones: guarda, lista, valida ids y borra', () => {
  assert.throws(() => C.guardarConv('../x', [{ role: 'user', content: 'a' }]), /inválido/)
  C.guardarConv('abc123', [{ role: 'user', content: 'hola' }, { role: 'system', content: 'no' }, { role: 'assistant', content: 'buenas' }])
  assert.equal(C.leerConv('abc123').msgs.length, 2); assert.equal(C.listarConv()[0].titulo, 'hola'); assert.ok(C.borrarConv('abc123')); assert.equal(C.leerConv('abc123'), null)
})
