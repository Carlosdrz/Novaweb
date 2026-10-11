/**
 * Tareas programadas reales. Un programador local revisa cada 15 s (DATA_DIR/programadas.json).
 *  · recordatorio: Nova lo dice y lo muestra a su hora.
 *  · consulta: Nova ejecuta una instrucción (p. ej. «resume las noticias de hoy») y comunica el resultado.
 *    Las consultas solo usan lectura (internet, si el permiso está activo): nunca modifican archivos ni envían nada.
 * Solo se ejecutan mientras Nova está en marcha. Si estuvo cerrada, al abrir ejecuta lo vencido (hasta 24 h atrás) una vez
 * y reprograma lo repetido; lo más viejo se marca como «omitida».
 */
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { DATA_DIR, writeAtomic, readJson, registrar } from './seguridad.mjs'
const F = () => join(DATA_DIR(), 'programadas.json')
const leer = () => { const l = readJson(F(), []); return Array.isArray(l) ? l : [] }
const guardar = (l) => writeAtomic(F(), JSON.stringify(l, null, 1))
const TZ = 'America/Santo_Domingo', GRACIA = 24 * 3600e3, REP = ['none', 'daily', 'weekdays', 'weekly']
const dia = (t) => new Date(t).toLocaleDateString('en-US', { weekday: 'short', timeZone: TZ })
export function siguiente(t, rep, now) {
  let x = t
  do { x += rep === 'weekly' ? 7 * 86400000 : 86400000; if (rep === 'weekdays' && /Sat|Sun/.test(dia(x))) continue } while (x <= now)
  return x
}
export function parseCuando(v) { const raw = String(v ?? ''); return Date.parse(/(Z|[+-]\d\d:?\d\d)$/.test(raw) ? raw : raw + '-04:00') }
function limpiar(d, previa = {}) {
  const t = { ...previa }
  if (d.titulo !== undefined) { t.titulo = String(d.titulo).replace(/\s+/g, ' ').trim().slice(0, 120); if (!t.titulo) throw new Error('Falta el título.') }
  if (d.descripcion !== undefined) t.descripcion = String(d.descripcion).trim().slice(0, 600)
  if (d.tipo !== undefined) { if (!['recordatorio', 'consulta'].includes(d.tipo)) throw new Error('Tipo no válido.'); t.tipo = d.tipo }
  if (d.repeat !== undefined) { if (!REP.includes(d.repeat)) throw new Error('Repetición no válida.'); t.repeat = d.repeat }
  if (d.at !== undefined) { const at = typeof d.at === 'number' ? d.at : parseCuando(d.at); if (!Number.isFinite(at)) throw new Error('Fecha y hora no válidas.'); if (at > Date.now() + 366 * 86400000) throw new Error('Máximo un año hacia adelante.'); if (at < Date.now() - 60000 && !previa.id) throw new Error('Esa hora ya pasó.'); t.at = Math.round(at) }
  if (d.proyecto !== undefined) t.proyecto = d.proyecto && /^[a-z0-9]{4,16}$/.test(d.proyecto) ? d.proyecto : null
  if (d.activo !== undefined) t.activo = d.activo === true
  if (t.tipo === 'consulta' && !t.descripcion) throw new Error('Una consulta necesita la instrucción en la descripción.')
  return t
}
export function crearProgramada(d) {
  const l = leer(); if (l.length >= 200) throw new Error('Hay demasiadas tareas.')
  const t = limpiar({ tipo: 'recordatorio', repeat: 'none', descripcion: '', activo: true, ...d })
  Object.assign(t, { id: randomBytes(4).toString('hex'), creada: Date.now(), runs: [], estado: 'pendiente' }); l.push(t); guardar(l); registrar('tarea programada', `Creó: ${t.titulo}`); return t
}
export function editarProgramada(id, d) {
  const l = leer(), i = l.findIndex((x) => x.id === id); if (i < 0) throw new Error('No existe esa tarea.')
  const t = limpiar(d, l[i]); if (d.at !== undefined || d.activo === true) t.estado = 'pendiente'; l[i] = t; guardar(l); return t
}
export function borrarProgramada(id) { const l = leer(), n = l.filter((x) => x.id !== id); guardar(n); registrar('tarea programada', `Canceló ${id}`); return l.length - n.length }
export const listarProgramadas = () => leer().sort((a, b) => (b.activo - a.activo) || (a.at - b.at))
export const proximasProgramadas = (n = 3) => leer().filter((t) => t.activo && t.at > Date.now() - 60000).sort((a, b) => a.at - b.at).slice(0, n)
const anotar = (t, estado, detalle) => { t.runs = [{ ts: Date.now(), estado, detalle: String(detalle ?? '').slice(0, 400) }, ...(t.runs ?? [])].slice(0, 20); t.ultima = t.runs[0]; if (estado === 'error') t.estado = 'error'; else if (t.estado !== 'error' || estado === 'ok') t.estado = estado === 'ok' ? 'ok' : t.estado }
async function ejecutar(t, runner) {
  let h
  try { const out = await Promise.race([runner(t), new Promise((_, no) => { h = setTimeout(() => no(new Error('Tardó más de 2 minutos.')), 120000) })]); clearTimeout(h); anotar(t, 'ok', out); registrar('tarea programada', `Ejecutó: ${t.titulo}`); return true }
  catch (e) { clearTimeout(h); anotar(t, 'error', e.message); registrar('tarea programada', `Falló: ${t.titulo}`, `error: ${e.message}`); return false }
}
export async function ejecutarAhora(id, runner) {
  const l = leer(), t = l.find((x) => x.id === id); if (!t) throw new Error('No existe esa tarea.')
  const ok = await ejecutar(t, runner); guardar(l.map((x) => (x.id === id ? t : x))); return { ok, tarea: t }
}
let ocupado = false
export async function tick(runner, now = Date.now()) {
  if (ocupado) return; ocupado = true
  try {
    const l = leer(); let cambio = false
    for (const t of l) {
      if (!t.activo || t.at > now) continue
      cambio = true
      if (now - t.at > GRACIA) anotar(t, 'omitida', 'Nova estaba cerrada a esa hora.'); else await ejecutar(t, runner)
      if (t.repeat && t.repeat !== 'none') t.at = siguiente(t.at, t.repeat, now); else { t.activo = false; if (t.estado === 'pendiente') t.estado = 'completada' }
    }
    if (cambio) guardar(l)
  } finally { ocupado = false }
}
export function iniciarProgramadas(runner, ms = 15000) { const f = () => tick(runner).catch(() => {}); f(); const h = setInterval(f, ms); h.unref?.(); return () => clearInterval(h) }
