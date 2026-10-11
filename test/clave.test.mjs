import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const data = mkdtempSync(join(tmpdir(), 'nova-k-'))
const arrancar = async (extra = {}) => {
  const env = { ...process.env, PORT: '8095', NOVA_DATA_DIR: data, NOVA_NOTICIAS: 'off', NOVA_LOCAL: '1', ...extra }; delete env.NOVA_PASSWORD; Object.assign(env, extra)
  const p = spawn('node', ['server.mjs'], { env, stdio: 'ignore' })
  for (let i = 0; i < 40; i++) { try { await fetch('http://127.0.0.1:8095/api/acceso'); return p } catch { await new Promise((r) => setTimeout(r, 200)) } }
  throw new Error('no arrancó')
}
const post = (u, d) => fetch('http://127.0.0.1:8095' + u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(d) })
test('primera vez: la página crea la contraseña; después la pide', async () => {
  let s = await arrancar()
  assert.equal((await (await fetch('http://127.0.0.1:8095/api/acceso')).json()).configurada, false)
  assert.equal((await post('/api/configurar', { password: 'corta' })).status, 400)
  const r = await post('/api/configurar', { password: 'katie-prueba-1' }); assert.equal(r.status, 200)
  const cookie = r.headers.get('set-cookie').split(';')[0]
  assert.equal((await fetch('http://127.0.0.1:8095/api/ping', { headers: { cookie } })).status, 200)
  assert.equal((await post('/api/configurar', { password: 'otra-clave-123' })).status, 403)   // no se puede cambiar desde fuera
  assert.ok(!readFileSync(join(data, 'clave.json'), 'utf8').includes('katie-prueba-1'))       // solo hash
  s.kill(); await new Promise((r) => setTimeout(r, 500))
  s = await arrancar()
  assert.equal((await (await fetch('http://127.0.0.1:8095/api/acceso')).json()).configurada, true)
  assert.equal((await post('/api/login', { password: 'mala-clave-xx' })).status, 401)
  assert.equal((await post('/api/login', { password: 'katie-prueba-1' })).status, 200)
  s.kill()
})
