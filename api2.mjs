/** Rutas de búsquedas, tareas programadas, proyectos, explorador de archivos y métricas. Devuelve true si atendió la ruta. */
import { readdirSync, statSync, appendFileSync, readFileSync, mkdirSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { ajustes, LOCAL, resolverPermitida, registrar, DATA_DIR } from './seguridad.mjs'
import { buscarMedios } from './medios.mjs'
import { registrarBusqueda, listarBusquedas, obtenerBusqueda, borrarBusqueda, limpiarBusquedas, vincularBusqueda } from './busquedas.mjs'
import { crearProgramada, editarProgramada, borrarProgramada, listarProgramadas, ejecutarAhora } from './programadas.mjs'
import * as P from './proyectos.mjs'
import { listarConv } from './conversaciones.mjs'

const okId = (s) => /^[a-z0-9]{4,16}$/.test(String(s ?? ''))
export async function manejarApi2(req, res, url, { json, body, runner }) {
  const p = url.pathname, m = req.method, seg = p.split('/').filter(Boolean)
  if (seg[0] !== 'api') return false
  const leer = async (max = 16 * 1024) => { try { return await body(req, max) } catch { json(res, 400, { error: 'Solicitud inválida.' }); return null } }
  const fallo = (e) => json(res, 400, { error: e.message })
  try {
    // ---- medios: imágenes y videos en streaming (SSE); se guarda en el historial al terminar
    if (p === '/api/medios' && m === 'GET') {
      const tipo = url.searchParams.get('tipo') === 'video' ? 'video' : 'imagen', q = url.searchParams.get('q') ?? '', proyecto = url.searchParams.get('proyecto')
      res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' })
      const ac = new AbortController(); res.on('close', () => ac.abort())
      const send = (o) => res.write(`data: ${JSON.stringify(o)}\n\n`), todos = []
      try {
        const r = await buscarMedios(tipo, q, (fuente, items) => { todos.push(...items); send({ t: 'items', fuente, items }) }, ac.signal)
        const e = registrarBusqueda({ q: r.q, tipo, fuentes: r.fuentes, estado: r.estado, resultados: todos, proyecto: okId(proyecto) ? proyecto : null, error: r.errores.join('; ') })
        send({ t: 'fin', ...r, id: e.id })
      } catch (e) { registrarBusqueda({ q, tipo, estado: 'error', error: e.message }); send({ t: 'error', message: e.message }) }
      res.end(); return true
    }
    if (p === '/api/busquedas' && m === 'GET') { const g = (k) => url.searchParams.get(k) ?? ''; const dias = Number(g('dias')) || 0; return json(res, 200, { items: listarBusquedas({ q: g('q'), tipo: g('tipo'), proyecto: g('proyecto'), desde: dias ? Date.now() - dias * 86400000 : 0 }) }), true }
    if (p === '/api/busquedas' && m === 'DELETE') { registrar('búsquedas', 'Limpió el historial'); return json(res, 200, { borradas: limpiarBusquedas() }), true }
    if (seg[1] === 'busquedas' && okId(seg[2])) {
      if (m === 'GET') { const e = obtenerBusqueda(seg[2]); return e ? json(res, 200, e) : json(res, 404, { error: 'No existe.' }), true }
      if (m === 'DELETE') return json(res, 200, { borradas: borrarBusqueda(seg[2]) }), true
      if (m === 'PUT') { const d = await leer(); if (!d) return true; return json(res, 200, { ok: vincularBusqueda(seg[2], d.proyecto) }), true }
    }
    // ---- tareas programadas
    if (p === '/api/programadas' && m === 'GET') return json(res, 200, { items: listarProgramadas() }), true
    if (p === '/api/programadas' && m === 'POST') { const d = await leer(); if (!d) return true; return json(res, 200, crearProgramada(d)), true }
    if (seg[1] === 'programadas' && okId(seg[2])) {
      if (m === 'PUT') { const d = await leer(); if (!d) return true; return json(res, 200, editarProgramada(seg[2], d)), true }
      if (m === 'DELETE') return json(res, 200, { borradas: borrarProgramada(seg[2]) }), true
      if (m === 'POST' && seg[3] === 'ejecutar') return json(res, 200, await ejecutarAhora(seg[2], runner)), true
    }
    // ---- proyectos
    if (p === '/api/proyectos' && m === 'GET') return json(res, 200, { items: P.listarProyectos() }), true
    if (p === '/api/proyectos' && m === 'POST') { const d = await leer(); if (!d) return true; const n = P.crearProyecto(d); registrar('proyecto', `Creó ${n.nombre}`); return json(res, 200, n), true }
    if (seg[1] === 'proyectos' && okId(seg[2])) {
      const pid = seg[2]
      if (seg.length === 3) {
        if (m === 'GET') { const pr = P.obtenerProyecto(pid); if (!pr) return json(res, 404, { error: 'No existe.' }), true
          return json(res, 200, { ...pr, conversaciones: listarConv().filter((c) => c.proyecto === pid), busquedas: listarBusquedas({ proyecto: pid }).slice(0, 30), tareas: listarProgramadas().filter((t) => t.proyecto === pid) }), true }
        if (m === 'PUT') { const d = await leer(); if (!d) return true; return json(res, 200, P.editarProyecto(pid, d)), true }
        if (m === 'DELETE') { registrar('proyecto', `Borró ${pid}`); return json(res, 200, { borrados: P.borrarProyecto(pid) }), true }
      }
      const sub = seg[3], sid = seg[4]
      if (sub === 'notas') { if (m === 'POST') { const d = await leer(); if (!d) return true; return json(res, 200, P.agregarNotaProyecto(pid, d.texto)), true } if (m === 'DELETE' && sid) return json(res, 200, P.borrarNotaProyecto(pid, sid)), true }
      if (sub === 'objetivos') {
        if (m === 'POST') { const d = await leer(); if (!d) return true; return json(res, 200, P.agregarObjetivo(pid, d.texto)), true }
        if (m === 'PUT' && sid) { const d = await leer(); if (!d) return true; return json(res, 200, P.cambiarObjetivo(pid, sid, d.hecho)), true }
        if (m === 'DELETE' && sid) return json(res, 200, P.borrarObjetivo(pid, sid)), true
      }
      if (sub === 'archivos') {
        if (m === 'POST') { if (!LOCAL()) return json(res, 403, { error: 'Vincular archivos solo está disponible al ejecutar Nova en su computadora.' }), true; const d = await leer(); if (!d) return true; registrar('proyecto', `Vinculó archivo: ${String(d.ruta).slice(-60)}`); return json(res, 200, P.vincularArchivo(pid, d.ruta)), true }
        if (m === 'DELETE' && sid) return json(res, 200, P.desvincularArchivo(pid, sid)), true
      }
    }
    // ---- explorador acotado a las carpetas autorizadas
    if (p === '/api/explorar' && m === 'GET') {
      if (!LOCAL()) return json(res, 403, { error: 'Solo disponible al ejecutar Nova en su computadora.' }), true
      const ruta = url.searchParams.get('ruta'), cs = ajustes().carpetas
      if (!cs.length) return json(res, 200, { ruta: null, items: [], aviso: 'No hay carpetas autorizadas. Añádalas en Configuración.' }), true
      if (!ruta) return json(res, 200, { ruta: null, items: cs.map((c) => ({ nombre: c, ruta: c, carpeta: true })) }), true
      const real = resolverPermitida(ruta), items = readdirSync(real, { withFileTypes: true }).filter((e) => !e.name.startsWith('.')).slice(0, 300).map((e) => ({ nombre: e.name, ruta: join(real, e.name), carpeta: e.isDirectory() })).sort((a, b) => (b.carpeta - a.carpeta) || a.nombre.localeCompare(b.nombre))
      let padre = null; try { const up = dirname(real); resolverPermitida(up); padre = up } catch {}
      return json(res, 200, { ruta: real, padre, items }), true
    }
    // ---- métricas de voz y respuesta (medidas en el navegador)
    if (p === '/api/metricas' && m === 'POST') { const d = await leer(2048); if (!d) return true; const n = (x) => (Number.isFinite(x) && x >= 0 && x < 600000 ? Math.round(x) : null)
      try { mkdirSync(DATA_DIR(), { recursive: true }); appendFileSync(join(DATA_DIR(), 'metricas.jsonl'), JSON.stringify({ ts: Date.now(), token: n(d.token), audio: n(d.audio), total: n(d.total), voz: d.voz === 'eleven' ? 'eleven' : 'navegador', visual: d.visual === true }) + '\n') } catch {}
      return json(res, 200, { ok: true }), true }
    if (p === '/api/metricas' && m === 'GET') {
      let l = []; try { l = readFileSync(join(DATA_DIR(), 'metricas.jsonl'), 'utf8').trim().split('\n').slice(-200).map((x) => JSON.parse(x)) } catch {}
      const med = (k) => { const v = l.map((x) => x[k]).filter((x) => x != null).sort((a, b) => a - b); return v.length ? { mediana: v[Math.floor(v.length / 2)], n: v.length, p90: v[Math.floor(v.length * 0.9)] } : null }
      return json(res, 200, { token: med('token'), audio: med('audio'), total: med('total') }), true
    }
    // ---- verificación de la voz de ElevenLabs
    if (p === '/api/voz' && m === 'GET') {
      const key = process.env.ELEVENLABS_API_KEY, id = process.env.NOVA_VOICE_ID ?? 'ojGau167OE7nUATM1xDa'
      if (!key) return json(res, 200, { ok: false, id, motivo: 'Sin clave de ElevenLabs: Nova usa la voz del navegador.' }), true
      try { const r = await fetch(`https://api.elevenlabs.io/v1/voices/${encodeURIComponent(id)}`, { headers: { 'xi-api-key': key }, signal: AbortSignal.timeout(8000) }); if (!r.ok) return json(res, 200, { ok: false, id, motivo: r.status === 401 ? 'La clave de ElevenLabs no es válida.' : r.status === 404 ? 'Esa voz no está disponible para su cuenta.' : `ElevenLabs respondió ${r.status}.` }), true
        const v = await r.json(); return json(res, 200, { ok: true, id, nombre: v.name, etiquetas: v.labels ?? {} }), true } catch (e) { return json(res, 200, { ok: false, id, motivo: 'No se pudo consultar ElevenLabs: ' + e.message }), true }
    }
  } catch (e) { return fallo(e), true }
  return false
}
