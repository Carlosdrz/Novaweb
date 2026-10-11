/** Historial persistente de búsquedas (DATA_DIR/busquedas.json). Guarda consulta, fuente, estado y los primeros resultados; no copia archivos multimedia. */
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { DATA_DIR, writeAtomic, readJson } from './seguridad.mjs'
const F = () => join(DATA_DIR(), 'busquedas.json')
const leer = () => { const l = readJson(F(), []); return Array.isArray(l) ? l : [] }
const MAX = 500
export function registrarBusqueda({ q, tipo, fuentes = [], estado = 'ok', resultados = [], proyecto = null, error = '' }) {
  const l = leer()
  const e = { id: randomBytes(4).toString('hex'), q: String(q).slice(0, 200), tipo: ['imagen', 'video', 'web'].includes(tipo) ? tipo : 'web', fuentes, estado, ts: Date.now(), proyecto: proyecto || null, error: String(error).slice(0, 200),
    resultados: resultados.slice(0, 12).map((r) => ({ tipo: r.tipo, titulo: r.titulo, thumb: r.thumb, url: r.url, src: r.src, embed: r.embed, pagina: r.pagina, fuente: r.fuente, licencia: r.licencia, autor: r.autor })) }
  l.unshift(e); writeAtomic(F(), JSON.stringify(l.slice(0, MAX))); return e
}
export function listarBusquedas({ q = '', tipo = '', proyecto = '', desde = 0 } = {}) {
  const s = String(q).toLowerCase()
  return leer().filter((e) => (!s || e.q.toLowerCase().includes(s)) && (!tipo || e.tipo === tipo) && (!proyecto || e.proyecto === proyecto) && e.ts >= desde).map(({ resultados, ...r }) => ({ ...r, n: resultados.length }))
}
export const obtenerBusqueda = (id) => leer().find((e) => e.id === id) ?? null
export function borrarBusqueda(id) { const l = leer(), n = l.filter((e) => e.id !== id); writeAtomic(F(), JSON.stringify(n)); return l.length - n.length }
export function limpiarBusquedas() { const n = leer().length; writeAtomic(F(), '[]'); return n }
export function vincularBusqueda(id, proyecto) { const l = leer(), e = l.find((x) => x.id === id); if (!e) return false; e.proyecto = proyecto || null; writeAtomic(F(), JSON.stringify(l)); return true }
