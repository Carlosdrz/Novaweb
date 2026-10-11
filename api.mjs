/** Rutas de la API para las secciones de la app (ya autenticadas). Devuelve true si atendió la ruta. */
import { ajustes, guardarAjustes, actividad, responderConfirmacion, carpetasSugeridas, appsDisponibles, LOCAL, registrar } from './seguridad.mjs'
import { listFacts, rememberFact, editFact, deleteFactAt, listReminders, addReminder, cancelReminder, describeWhen } from './agenda.mjs'
import { listarNotas, agregarNota, borrarNota, listarTareas, agregarTarea, cambiarTarea, borrarTarea } from './notas.mjs'
import { guardarConv, leerConv, listarConv, borrarConv } from './conversaciones.mjs'
import { casaConfigurada } from './casa.mjs'
import { proveedoresExternos } from './fuentes.mjs'

export async function manejarApi(req, res, url, { json, body, voz }) {
  const p = url.pathname, m = req.method
  const seg = p.split('/').filter(Boolean) // ['api', ...]
  if (seg[0] !== 'api') return false
  const leer = async (max = 16 * 1024) => { try { return await body(req, max) } catch { json(res, 400, { error: 'Solicitud inválida.' }); return null } }
  const fallo = (e) => json(res, 400, { error: e.message })

  if (p === '/api/estado') return json(res, 200, { ajustes: ajustes(), local: LOCAL(), casa: casaConfigurada(), ias: proveedoresExternos(), voz, apps: Object.keys(appsDisponibles()), sugeridas: LOCAL() ? carpetasSugeridas() : [], plataforma: process.platform }), true
  if (p === '/api/ajustes' && m === 'PUT') { const d = await leer(); if (!d) return true; try { return json(res, 200, guardarAjustes(d)), true } catch (e) { return fallo(e), true } }
  if (p === '/api/actividad') return json(res, 200, { items: actividad(120) }), true
  if (p === '/api/confirmar' && m === 'POST') { const d = await leer(2048); if (!d) return true; return json(res, 200, { ok: responderConfirmacion(d.id, d.ok === true) }), true }

  if (p === '/api/memoria' && m === 'GET') return json(res, 200, { activa: ajustes().permisos.memoria, items: listFacts() }), true
  if (p === '/api/memoria' && m === 'POST') { const d = await leer(); if (!d) return true; try { return json(res, 200, rememberFact(d.texto, { manual: true })), true } catch (e) { return fallo(e), true } }
  if (seg[1] === 'memoria' && seg[2] !== undefined && (m === 'PUT' || m === 'DELETE')) {
    const i = Number(seg[2])
    try { if (m === 'DELETE') deleteFactAt(i); else { const d = await leer(); if (!d) return true; editFact(i, d.texto) }; registrar('memoria', m === 'DELETE' ? 'Recuerdo borrado' : 'Recuerdo editado'); return json(res, 200, { ok: true }), true } catch (e) { return fallo(e), true }
  }

  if (p === '/api/notas' && m === 'GET') return json(res, 200, { items: listarNotas() }), true
  if (p === '/api/notas' && m === 'POST') { const d = await leer(); if (!d) return true; try { return json(res, 200, agregarNota(d.texto, d.titulo)), true } catch (e) { return fallo(e), true } }
  if (seg[1] === 'notas' && seg[2] && m === 'DELETE') return json(res, 200, { borradas: borrarNota(seg[2]).length }), true
  if (p === '/api/tareas' && m === 'GET') return json(res, 200, { items: listarTareas() }), true
  if (p === '/api/tareas' && m === 'POST') { const d = await leer(); if (!d) return true; try { return json(res, 200, agregarTarea(d.texto, d.vence)), true } catch (e) { return fallo(e), true } }
  if (seg[1] === 'tareas' && seg[2] && m === 'PUT') { const d = await leer(); if (!d) return true; return json(res, 200, { cambiadas: cambiarTarea(seg[2], d.hecha !== false).length }), true }
  if (seg[1] === 'tareas' && seg[2] && m === 'DELETE') return json(res, 200, { borradas: borrarTarea(seg[2]).length }), true

  if (p === '/api/recordatorios' && m === 'GET') return json(res, 200, { items: listReminders().map((r) => ({ id: r.id, text: r.text, cuando: describeWhen(r.at), repeat: r.repeat ?? 'none' })) }), true
  if (p === '/api/recordatorios' && m === 'POST') {
    const d = await leer(); if (!d) return true
    try { const raw = String(d.at ?? ''); const r = addReminder({ text: d.text, atMs: Date.parse(/(Z|[+-]\d\d:?\d\d)$/.test(raw) ? raw : raw + '-04:00'), repeat: d.repeat }); registrar('recordatorio', `Creó: ${r.text}`); return json(res, 200, r), true } catch (e) { return fallo(e), true }
  }
  if (seg[1] === 'recordatorios' && seg[2] && m === 'DELETE') { const g = cancelReminder(seg[2]); registrar('recordatorio', `Canceló ${seg[2]}`); return json(res, 200, { canceladas: g.length }), true }

  if (p === '/api/conversaciones' && m === 'GET') return json(res, 200, { items: listarConv() }), true
  if (seg[1] === 'conversaciones' && seg[2]) {
    if (m === 'GET') { const c = leerConv(seg[2]); return c ? json(res, 200, c) : json(res, 404, { error: 'No existe.' }), true }
    if (m === 'PUT') { const d = await leer(512 * 1024); if (!d) return true; try { return json(res, 200, { ok: Boolean(guardarConv(seg[2], d.msgs)) }), true } catch (e) { return fallo(e), true } }
    if (m === 'DELETE') return json(res, 200, { ok: borrarConv(seg[2]) }), true
  }
  return false
}
