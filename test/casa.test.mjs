import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
process.env.NOVA_DATA_DIR = mkdtempSync(join(tmpdir(), 'nova-c-'))
// Simulador mínimo de Home Assistant (esto es una PRUEBA con servicio simulado, no con un Home Assistant real)
const luces = { 'light.sala': 'off' }
const srv = http.createServer((q, r) => {
  if (q.headers.authorization !== 'Bearer tok') { r.writeHead(401); return r.end() }
  const m = q.url.match(/services\/(\w+)\/(\w+)/)
  if (q.method === 'POST' && m) { let b = ''; q.on('data', (c) => (b += c)); q.on('end', () => { luces[JSON.parse(b).entity_id] = m[2] === 'turn_on' ? 'on' : 'off'; r.end('[]') }); return }
  if (q.url.includes('/states/')) return r.end(JSON.stringify({ entity_id: 'light.sala', state: luces['light.sala'] }))
  r.end(JSON.stringify(Object.entries(luces).map(([entity_id, state]) => ({ entity_id, state, attributes: { friendly_name: 'Sala' } }))))
}).listen(0)
process.env.HA_URL = `http://127.0.0.1:${srv.address().port}`; process.env.HA_TOKEN = 'tok'
const C = await import('../casa.mjs')
test('hogar: enciende y verifica el estado real', async () => { assert.equal(await C.accionar('light.sala', 'on'), 'on'); assert.equal(await C.accionar('light.sala', 'off'), 'off') })
test('hogar: rechaza dominios no permitidos (cerraduras, alarmas)', async () => { await assert.rejects(() => C.accionar('lock.puerta', 'on'), /solo controlo/) })
test('hogar: lista dispositivos', async () => assert.match((await C.listar('light'))[0], /light\.sala/))
test.after(() => srv.close())
