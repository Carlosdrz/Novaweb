import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
process.env.NOVA_DATA_DIR = mkdtempSync(join(tmpdir(), 'nova-'))
const { respaldo } = await import('../fuentes.mjs')
const { guardarClaves, estadoClaves } = await import('../claves.mjs')
test('respaldo usa Gemini cuando hay clave', async () => {
  const srv = http.createServer((q, r) => { r.setHeader('content-type', 'application/json'); r.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Hola Señor, la respuesta es 4.' }] } }] })) })
  await new Promise((ok) => srv.listen(0, ok))
  process.env.GEMINI_BASE_URL = `http://127.0.0.1:${srv.address().port}`; process.env.GEMINI_API_KEY = 'x'
  const r = await respaldo([{ role: 'user', content: '2+2' }])
  srv.close(); assert.equal(r.via, 'Gemini'); assert.match(r.texto, /4/)
})
test('claves se guardan sin devolverse', () => {
  const e = guardarClaves({ openai: 'sk-abc', voiceId: 'v123' })
  assert.equal(e.openai, true); assert.ok(!JSON.stringify(e).includes('sk-abc'))
  assert.throws(() => guardarClaves({ gemini: 'a b' }))
})
