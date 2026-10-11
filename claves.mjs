// Claves de otras IAs y de la voz, guardadas solo en el servidor (DATA_DIR/claves.json, permisos 600).
// Nunca se devuelven al navegador: solo se informa si existen.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
const DIR = () => process.env.NOVA_DATA_DIR ?? join(process.cwd(), 'data')
const F = () => join(DIR(), 'claves.json')
const MAPA = { openai: 'OPENAI_API_KEY', gemini: 'GEMINI_API_KEY', eleven: 'ELEVENLABS_API_KEY', voiceId: 'NOVA_VOICE_ID', youtube: 'YOUTUBE_API_KEY', vEstab: 'NOVA_VOZ_ESTABILIDAD', vSim: 'NOVA_VOZ_SIMILITUD', vEstilo: 'NOVA_VOZ_ESTILO', vVel: 'NOVA_VOZ_VELOCIDAD' }
export function cargarClaves() {
  let j = {}; try { j = JSON.parse(readFileSync(F(), 'utf8')) } catch {}
  for (const [k, env] of Object.entries(MAPA)) if (typeof j[k] === 'string' && j[k] && !process.env[env]) process.env[env] = j[k]
}
export function estadoClaves() { const o = {}; for (const [k, env] of Object.entries(MAPA)) o[k] = Boolean(process.env[env]); o.voiceIdActual = process.env.NOVA_VOICE_ID ?? ''; o.vozParams = { estab: process.env.NOVA_VOZ_ESTABILIDAD ?? '', sim: process.env.NOVA_VOZ_SIMILITUD ?? '', estilo: process.env.NOVA_VOZ_ESTILO ?? '', vel: process.env.NOVA_VOZ_VELOCIDAD ?? '' }; return o }
export function guardarClaves(d) {
  let j = {}; try { j = JSON.parse(readFileSync(F(), 'utf8')) } catch {}
  for (const k of Object.keys(MAPA)) {
    if (typeof d[k] !== 'string') continue
    const v = d[k].trim()
    if (v.length > 300 || /[\r\n\s]/.test(v)) throw new Error('Valor no válido.')
    if (v) { j[k] = v; process.env[MAPA[k]] = v } else { delete j[k]; delete process.env[MAPA[k]] }
  }
  mkdirSync(dirname(F()), { recursive: true }); writeFileSync(F(), JSON.stringify(j), { mode: 0o600 })
  return estadoClaves()
}
