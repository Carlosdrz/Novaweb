import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
process.env.NOVA_DATA_DIR = mkdtempSync(join(tmpdir(), 'nova-f-'))
// Servicios SIMULADOS (pruebas con servidores falsos; no son las APIs reales)
const sim = http.createServer((q, r) => {
  const u = new URL(q.url, 'http://x'), send = (o) => { r.setHeader('content-type', 'application/json'); r.end(JSON.stringify(o)) }
  if (u.pathname === '/w/api.php') return send({ query: { search: [{ title: 'Número complejo' }] } })
  if (u.pathname.startsWith('/api/rest_v1/page/summary/')) return send({ title: 'Número complejo', extract: 'Un número complejo tiene parte real e imaginaria.', content_urls: { desktop: { page: 'https://es.wikipedia.org/wiki/N%C3%BAmero_complejo' } } })
  if (u.pathname === '/v1/search') return send({ results: [{ name: 'Santo Domingo', country: 'República Dominicana', latitude: 18.5, longitude: -69.9 }] })
  if (u.pathname === '/v1/forecast') return send({ current: { temperature_2m: 31, apparent_temperature: 35, relative_humidity_2m: 70, weather_code: 2, wind_speed_10m: 12 }, daily: { time: ['2026-10-11'], temperature_2m_max: [32], temperature_2m_min: [25], precipitation_probability_max: [40] } })
  if (u.pathname.endsWith('/chat/completions')) return q.headers.authorization === 'Bearer k1' ? send({ choices: [{ message: { content: 'Respuesta de OpenAI simulada' } }] }) : (r.statusCode = 401, r.end())
  if (u.pathname.includes(':generateContent')) return q.headers['x-goog-api-key'] === 'k2' ? send({ candidates: [{ content: { parts: [{ text: 'Respuesta de Gemini simulada' }] } }] }) : (r.statusCode = 403, r.end())
  r.statusCode = 404; r.end()
}).listen(0)
const B = `http://127.0.0.1:${sim.address().port}`
Object.assign(process.env, { WIKI_BASE: B, METEO_GEO_BASE: B, METEO_BASE: B, OPENAI_BASE_URL: B + '/v1', GEMINI_BASE_URL: B + '/v1beta', OPENAI_API_KEY: 'k1', GEMINI_API_KEY: 'k2' })
const F = await import('../fuentes.mjs')
test('wikipedia: devuelve resumen y URL', async () => { const w = await F.wikipedia('número complejo'); assert.match(w.resumen, /parte real/); assert.match(w.url, /wikipedia/) })
test('clima: combina geocodificación y pronóstico', async () => { const c = await F.clima('Santo Domingo'); assert.equal(c.ahora.temperatura, 31); assert.equal(c.ahora.cielo, 'parcialmente nublado'); assert.equal(c.proximos_dias.length, 1) })
test('consejo: combina todas las fuentes y tolera fallos parciales', async () => {
  const run = async (n) => { if (n === 'verificador') throw new Error('se cayó'); return `borrador ${n}` }
  const r = await F.consultarConsejo('¿Qué es un número complejo?', { run })
  assert.match(r.texto, /borrador investigador/); assert.match(r.texto, /OpenAI simulada/); assert.match(r.texto, /Gemini simulada/); assert.match(r.texto, /parte real/)
  assert.equal(r.fuentes, 5); assert.ok(r.fallos.some((f) => /Verificador/.test(f)))
})
test('consejo: si una clave es inválida solo falla esa fuente', async () => {
  process.env.OPENAI_API_KEY = 'mala'
  const r = await F.consultarConsejo('x', { run: async (n) => `b ${n}` }); assert.ok(r.fallos.some((f) => /OpenAI/.test(f))); assert.match(r.texto, /Gemini/)
  process.env.OPENAI_API_KEY = 'k1'
})
test('proveedores externos: solo se listan los que tienen clave', () => { assert.deepEqual(F.proveedoresExternos(), ['OpenAI', 'Gemini']); delete process.env.GEMINI_API_KEY; assert.deepEqual(F.proveedoresExternos(), ['OpenAI']) })
test.after(() => sim.close())
