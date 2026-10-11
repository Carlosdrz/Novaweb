/** Historial de conversaciones: un archivo JSON por conversación en DATA_DIR/conversaciones. */
import { join } from 'node:path'
import { mkdirSync, readdirSync, readFileSync, unlinkSync } from 'node:fs'
import { DATA_DIR, writeAtomic, readJson } from './seguridad.mjs'

const dir = () => join(DATA_DIR(), 'conversaciones')
const okId = (id) => /^[a-z0-9]{6,24}$/.test(String(id))
const f = (id) => join(dir(), `${id}.json`)

export function guardarConv(id, msgs, proyecto = null) {
  if (!okId(id)) throw new Error('id inválido')
  if (!Array.isArray(msgs) || msgs.length > 400) throw new Error('mensajes inválidos')
  const limpio = msgs.filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string').map((m) => ({ role: m.role, content: m.content.slice(0, 20000) }))
  if (!limpio.length) return null
  mkdirSync(dir(), { recursive: true })
  const c = { id, titulo: (limpio.find((m) => m.role === 'user')?.content ?? 'Conversación').slice(0, 70), actualizada: Date.now(), proyecto: /^[a-z0-9]{4,16}$/.test(proyecto ?? '') ? proyecto : null, msgs: limpio }
  writeAtomic(f(id), JSON.stringify(c)); return c
}
export const leerConv = (id) => (okId(id) ? readJson(f(id), null) : null)
export function listarConv() {
  try { return readdirSync(dir()).filter((n) => n.endsWith('.json')).map((n) => readJson(join(dir(), n), null)).filter(Boolean).map(({ id, titulo, actualizada, proyecto }) => ({ id, titulo, actualizada, proyecto: proyecto ?? null })).sort((a, b) => b.actualizada - a.actualizada).slice(0, 100) } catch { return [] }
}
export function borrarConv(id) { if (!okId(id)) return false; try { unlinkSync(f(id)); return true } catch { return false } }
