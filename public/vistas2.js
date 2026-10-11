'use strict';
// Barra lateral, Proyectos, Historial de búsquedas y Tareas programadas. Todo texto del usuario entra con textContent.
(() => {
  const N = window.Nova, $ = (id) => document.getElementById(id), api = N.api, app = $('app')
  const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x !== undefined) e.textContent = x; return e }
  const btn = (txt, fn, cls = '') => { const b = el('button', cls, txt); b.type = 'button'; b.onclick = fn; return b }
  const fecha = (t) => new Date(t).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })
  const err = (e) => N.aviso(e.message || 'Algo falló.')
  const REP = { none: 'Una vez', daily: 'Todos los días', weekdays: 'Lunes a viernes', weekly: 'Cada semana' }
  const ESTADO_T = { pendiente: ['Pendiente', 'amb'], ok: ['Ejecutada', 'ok'], error: ['Con error', 'mal'], completada: ['Completada', 'ok'], omitida: ['Omitida', 'amb'] }
  const vistas = (N.vistas = {})
  // confirmación en la propia pantalla (sin diálogos del navegador)
  const confirmar = (cont, texto, fn) => { const c = el('div', 'fila-item'); c.append(el('div', 't', texto), btn('Sí, continuar', () => { c.remove(); fn() }, 'pel'), btn('Cancelar', () => c.remove())); cont.prepend(c) }

  // ================= barra lateral =================
  const nav = $('nav')
  nav.addEventListener('click', (e) => { const b = e.target.closest('.ni[data-v]'); if (b) N.ir(b.dataset.v) })
  $('navNuevo').onclick = () => { $('nuevo').click(); app.classList.remove('navAbierto') }
  const min = (v) => { app.classList.toggle('navMin', v); $('navToggle').setAttribute('aria-expanded', String(!v)); try { localStorage.setItem('nova-nav', v ? '1' : '0') } catch {} }
  $('navToggle').onclick = () => min(!app.classList.contains('navMin'))
  try { if (localStorage.getItem('nova-nav') === '1') min(true) } catch {}
  $('navAbrir').onclick = () => app.classList.toggle('navAbierto')
  document.addEventListener('click', (e) => { if (app.classList.contains('navAbierto') && !e.target.closest('#nav') && !e.target.closest('#navAbrir')) app.classList.remove('navAbierto') })
  async function recientes() {
    const l = $('recientes'); try {
      const { items } = await api('/api/conversaciones'); l.replaceChildren()
      for (const c of items.slice(0, 5)) { const b = btn(c.titulo, async () => { try { N.abrirConv(await api('/api/conversaciones/' + c.id)); N.ir('inicio') } catch (e) { err(e) } }); b.title = c.titulo; if (c.id === N.state.convId) b.classList.add('on'); l.append(b) }
      if (items.length > 5) l.append(btn('Ver todas…', () => N.ir('conversaciones'), 'mas'))
    } catch {}
  }
  N.recientes = recientes; if (!app.hidden) recientes()

  // ================= proyectos =================
  let proyAbierto = null
  vistas.proyectos = async () => { proyAbierto ? detalleProyecto(proyAbierto) : listaProyectos() }
  async function listaProyectos() {
    proyAbierto = null; const v = $('v-proyectos'); v.replaceChildren()
    v.append(el('h1', '', 'Proyectos'), el('p', 'sub', 'Cada proyecto reúne objetivos, notas, archivos y conversaciones. Al trabajar dentro de uno, Nova usa solo su contexto.'))
    const f = el('form', 'fila wrap'), n = el('input'), d = el('input'); n.placeholder = 'Nombre del proyecto'; n.maxLength = 80; n.required = true; d.placeholder = 'Descripción (opcional)'; d.maxLength = 400
    f.append(n, d, el('button', 'btn', 'Crear')); f.onsubmit = async (e) => { e.preventDefault(); try { const p = await api('/api/proyectos', { method: 'POST', body: JSON.stringify({ nombre: n.value, descripcion: d.value }) }); detalleProyecto(p.id) } catch (x) { err(x) } }
    const g = el('div', 'cols'); v.append(f, g)
    try {
      const { items } = await api('/api/proyectos')
      if (!items.length) g.replaceWith(el('p', 'sub', 'Aún no hay proyectos. Cree el primero arriba; por ejemplo «Tesis», «App de ventas» o «Estudio de física».'))
      for (const p of items) { const c = el('button', 'caja tarjProy'); c.type = 'button'; c.append(el('h3', '', p.nombre), el('span', 'sub peq', p.descripcion || 'Sin descripción')); const m = el('div'); m.append(el('span', 'etq ' + (p.estado === 'activo' ? 'ok' : p.estado === 'pausado' ? 'amb' : ''), p.estado), el('span', 'etq', p.pendientes + ' pendientes'), el('span', 'etq', p.archivos + ' archivos')); c.append(m); c.onclick = () => detalleProyecto(p.id); g.append(c) }
    } catch (x) { err(x) }
  }
  async function detalleProyecto(id) {
    proyAbierto = id; const v = $('v-proyectos'); v.replaceChildren(); let p
    try { p = await api('/api/proyectos/' + id) } catch (x) { err(x); return listaProyectos() }
    const refrescar = () => detalleProyecto(id)
    v.append(btn('← Todos los proyectos', listaProyectos, 'migas'))
    const cab = el('div', 'fila wrap'), nom = el('input'); nom.value = p.nombre; nom.maxLength = 80; nom.setAttribute('aria-label', 'Nombre'); nom.onchange = () => api('/api/proyectos/' + id, { method: 'PUT', body: JSON.stringify({ nombre: nom.value }) }).then(() => { if (N.state.proyecto === id) N.fijarProyecto(id, nom.value) }).catch(err)
    const est = el('select'); for (const e of ['activo', 'pausado', 'terminado']) { const o = el('option', '', e); o.value = e; est.append(o) } est.value = p.estado; est.onchange = () => api('/api/proyectos/' + id, { method: 'PUT', body: JSON.stringify({ estado: est.value }) }).catch(err)
    cab.append(nom, est, btn('Trabajar en este proyecto', () => { N.fijarProyecto(id, p.nombre); N.nueva(); N.ir('inicio'); N.aviso('') }, 'btn'))
    const desc = el('textarea'); desc.rows = 2; desc.maxLength = 400; desc.value = p.descripcion; desc.placeholder = 'Descripción del proyecto'; desc.onchange = () => api('/api/proyectos/' + id, { method: 'PUT', body: JSON.stringify({ descripcion: desc.value }) }).catch(err)
    v.append(cab, desc)
    const dos = el('div', 'cols')
    // objetivos
    const ob = el('div', 'caja'); ob.append(el('h2', '', 'Objetivos y pendientes'))
    const lo = el('ul', 'items'); for (const o of p.objetivos) { const li = el('li', 'fila-item'), lab = el('label', 'check' + (o.hecho ? ' hecho' : '')), cb = el('input'); cb.type = 'checkbox'; cb.checked = o.hecho; cb.onchange = () => api(`/api/proyectos/${id}/objetivos/${o.id}`, { method: 'PUT', body: JSON.stringify({ hecho: cb.checked }) }).then(refrescar).catch(err); lab.append(cb, el('span', '', o.texto)); li.append(el('div', 't'), btn('✕', () => api(`/api/proyectos/${id}/objetivos/${o.id}`, { method: 'DELETE' }).then(refrescar).catch(err), 'pel')); li.firstChild.append(lab); lo.append(li) }
    const fo = el('form', 'fila'), io = el('input'); io.placeholder = 'Nuevo objetivo'; io.maxLength = 200; fo.append(io, el('button', 'btn', '+')); fo.onsubmit = (e) => { e.preventDefault(); if (io.value.trim()) api(`/api/proyectos/${id}/objetivos`, { method: 'POST', body: JSON.stringify({ texto: io.value }) }).then(refrescar).catch(err) }
    ob.append(fo, lo); if (!p.objetivos.length) lo.append(el('p', 'sub peq', 'Sin objetivos todavía.'))
    // notas
    const no = el('div', 'caja'); no.append(el('h2', '', 'Notas'))
    const fn = el('form', 'fila'), tn = el('input'); tn.placeholder = 'Nueva nota'; tn.maxLength = 1000; fn.append(tn, el('button', 'btn', '+')); fn.onsubmit = (e) => { e.preventDefault(); if (tn.value.trim()) api(`/api/proyectos/${id}/notas`, { method: 'POST', body: JSON.stringify({ texto: tn.value }) }).then(refrescar).catch(err) }
    const ln = el('ul', 'items'); for (const n of p.notas.slice(0, 15)) { const li = el('li', 'fila-item'), t = el('div', 't', n.texto); t.append(el('small', '', fecha(n.ts))); li.append(t, btn('✕', () => api(`/api/proyectos/${id}/notas/${n.id}`, { method: 'DELETE' }).then(refrescar).catch(err), 'pel')); ln.append(li) }
    no.append(fn, ln); if (!p.notas.length) ln.append(el('p', 'sub peq', 'Sin notas.'))
    dos.append(ob, no); v.append(dos)
    // archivos
    const ar = el('div', 'caja'); ar.append(el('h2', '', 'Archivos vinculados'), el('p', 'sub peq', 'Nova solo lee texto y código (.txt, .md, .csv, .json, .py, .js, …) dentro de las carpetas que usted autorizó. Un PDF o Word se vincula pero Nova no puede leerlo todavía.'))
    const la = el('ul', 'items')
    for (const a of p.archivos) { const li = el('li', 'fila-item'), t = el('div', 't', a.nombre + (a.carpeta ? ' (carpeta)' : '')); t.append(el('small', '', a.disponible ? (a.carpeta ? 'Carpeta disponible' : Math.max(1, Math.round(a.tam / 1024)) + ' KB') : 'No disponible: ' + a.motivo)); if (!a.disponible) t.style.color = 'var(--ambar)'; li.append(t, btn('Desvincular', () => api(`/api/proyectos/${id}/archivos/${a.id}`, { method: 'DELETE' }).then(refrescar).catch(err), 'pel')); la.append(li) }
    if (!p.archivos.length) la.append(el('p', 'sub peq', 'Ningún archivo vinculado.'))
    const ex = el('div'); ex.hidden = true
    const abrir = btn('+ Vincular archivo o carpeta', () => { ex.hidden = !ex.hidden; if (!ex.hidden) explorar(ex, null, id, refrescar) }, 'btn sec')
    ar.append(la, abrir, ex); v.append(ar)
    // relacionados
    const rel = el('div', 'cols')
    const cv = el('div', 'caja'); cv.append(el('h2', '', 'Conversaciones del proyecto'))
    for (const c of p.conversaciones) { const li = el('div', 'fila-item'), t = el('div', 't', c.titulo); t.append(el('small', '', fecha(c.actualizada))); li.append(t, btn('Abrir', async () => { try { N.abrirConv(await api('/api/conversaciones/' + c.id)); N.ir('inicio') } catch (x) { err(x) } })); cv.append(li) }
    if (!p.conversaciones.length) cv.append(el('p', 'sub peq', 'Aún ninguna. Pulse «Trabajar en este proyecto» y converse.'))
    const bq = el('div', 'caja'); bq.append(el('h2', '', 'Búsquedas relacionadas'))
    for (const b of p.busquedas.slice(0, 8)) { const li = el('div', 'fila-item'), t = el('div', 't', b.q); t.append(el('small', '', b.tipo + ' · ' + fecha(b.ts))); li.append(t); bq.append(li) }
    if (!p.busquedas.length) bq.append(el('p', 'sub peq', 'Ninguna. Las búsquedas hechas dentro del proyecto aparecen aquí.'))
    const tp = el('div', 'caja'); tp.append(el('h2', '', 'Tareas programadas'))
    for (const t of p.tareas) { const li = el('div', 'fila-item'), x = el('div', 't', t.titulo); x.append(el('small', '', (t.activo ? fecha(t.at) : 'Inactiva') + ' · ' + REP[t.repeat])); li.append(x); tp.append(li) }
    if (!p.tareas.length) tp.append(el('p', 'sub peq', 'Ninguna. Puede asociarlas desde Tareas programadas.'))
    const ac = el('div', 'caja'); ac.append(el('h2', '', 'Actividad')); const ha = el('ul', 'hist'); for (const a of (p.actividad || []).slice(0, 12)) { const li = el('li'); li.append(el('span', '', fecha(a.ts)), el('b', '', a.texto)); ha.append(li) } ac.append(ha)
    rel.append(cv, bq, tp, ac); v.append(rel)
    const peligro = el('div', 'fila'); peligro.append(btn('Eliminar proyecto', () => confirmar(v, `¿Eliminar «${p.nombre}»? Se borran sus objetivos y notas; no se tocan sus archivos ni conversaciones.`, () => api('/api/proyectos/' + id, { method: 'DELETE' }).then(() => { if (N.state.proyecto === id) N.fijarProyecto(null); listaProyectos() }).catch(err)), 'btn sec')); v.append(peligro)
  }
  async function explorar(cont, ruta, pid, refrescar) {
    cont.replaceChildren(); let d
    try { d = await api('/api/explorar' + (ruta ? '?ruta=' + encodeURIComponent(ruta) : '')) } catch (e) { cont.append(el('p', 'errMed', e.message)); return }
    if (d.aviso) { cont.append(el('p', 'sub peq', d.aviso)); return }
    cont.append(el('div', 'erp', d.ruta || 'Carpetas autorizadas'))
    if (d.ruta) { const fv = el('div', 'fila wrap'); fv.append(btn('Vincular esta carpeta', () => api(`/api/proyectos/${pid}/archivos`, { method: 'POST', body: JSON.stringify({ ruta: d.ruta }) }).then(refrescar).catch(err), 'btn'), ...(d.padre ? [btn('↑ Subir', () => explorar(cont, d.padre, pid, refrescar), 'btn sec')] : [btn('↑ Inicio', () => explorar(cont, null, pid, refrescar), 'btn sec')])); cont.append(fv) }
    const l = el('div', 'explor')
    for (const it of d.items) l.append(btn((it.carpeta ? '📁 ' : '📄 ') + it.nombre, () => (it.carpeta ? explorar(cont, it.ruta, pid, refrescar) : api(`/api/proyectos/${pid}/archivos`, { method: 'POST', body: JSON.stringify({ ruta: it.ruta }) }).then(refrescar).catch(err))))
    if (!d.items.length) l.append(el('p', 'sub peq', 'Carpeta vacía.'))
    cont.append(l)
  }

  // ================= historial de búsquedas =================
  vistas.busquedas = async () => {
    const v = $('v-busquedas'); v.replaceChildren()
    v.append(el('h1', '', 'Historial de búsquedas'), el('p', 'sub', 'Se guarda la consulta, la fecha, la fuente y los primeros resultados. Los enlaces externos pueden dejar de funcionar con el tiempo.'))
    const b = el('div', 'barra'), q = el('input'), t = el('select'), d = el('select'); q.type = 'search'; q.placeholder = 'Buscar en el historial'; q.setAttribute('aria-label', 'Buscar en el historial')
    for (const [val, tx] of [['', 'Todos los tipos'], ['imagen', 'Imágenes'], ['video', 'Videos'], ['web', 'Web']]) { const o = el('option', '', tx); o.value = val; t.append(o) }
    for (const [val, tx] of [['', 'Cualquier fecha'], ['1', 'Último día'], ['7', 'Última semana'], ['30', 'Último mes']]) { const o = el('option', '', tx); o.value = val; d.append(o) }
    b.append(q, t, d, btn('Limpiar historial', () => confirmar(lista, '¿Borrar todo el historial de búsquedas? No se puede deshacer.', () => api('/api/busquedas', { method: 'DELETE' }).then(pintar).catch(err)), 'btn sec'))
    const res = el('div'), lista = el('div', 'lista'); v.append(b, res, lista)
    let proy = []; try { proy = (await api('/api/proyectos')).items } catch {}
    async function pintar() {
      lista.replaceChildren()
      try {
        const { items } = await api(`/api/busquedas?q=${encodeURIComponent(q.value)}&tipo=${t.value}&dias=${d.value}`)
        if (!items.length) lista.append(el('p', 'sub', q.value || t.value || d.value ? 'Ninguna búsqueda coincide con esos filtros.' : 'Todavía no hay búsquedas. Pida a Nova, por ejemplo: «muéstrame imágenes de un agujero negro».'))
        for (const e of items) {
          const f = el('div', 'fila-item'), tx = el('div', 't'); tx.append(el('b', '', e.q)); tx.style.fontWeight = '400'
          const m = el('small'); m.append(el('span', 'etq', e.tipo), el('span', 'etq ' + (e.estado === 'ok' ? 'ok' : e.estado === 'error' ? 'mal' : 'amb'), e.estado === 'ok' ? 'correcta' : e.estado === 'error' ? 'fallida' : 'sin resultados'), document.createTextNode(fecha(e.ts) + (e.fuentes.length ? ' · ' + e.fuentes.join(', ') : '') + (e.n ? ` · ${e.n} guardados` : ''))); tx.append(m)
          const acc = el('div', 'acc')
          if (e.n) acc.append(btn('Ver', async () => { res.replaceChildren(); window.NovaMedios.mostrarGuardada(await api('/api/busquedas/' + e.id), res); res.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }))
          if (e.tipo !== 'web') acc.append(btn('Repetir', () => { N.ir('inicio'); const i = $('txt'); i.value = `${e.tipo === 'video' ? 'Muéstrame videos' : 'Muéstrame imágenes'} de ${e.q}`; $('form').requestSubmit() }))
          const sel = el('select'); sel.setAttribute('aria-label', 'Vincular a proyecto'); const o0 = el('option', '', 'Sin proyecto'); o0.value = ''; sel.append(o0); for (const p of proy) { const o = el('option', '', p.nombre); o.value = p.id; sel.append(o) } sel.value = e.proyecto || ''; sel.onchange = () => api('/api/busquedas/' + e.id, { method: 'PUT', body: JSON.stringify({ proyecto: sel.value }) }).catch(err)
          if (proy.length) acc.append(sel)
          acc.append(btn('Borrar', () => api('/api/busquedas/' + e.id, { method: 'DELETE' }).then(pintar).catch(err), 'pel'))
          f.append(tx, acc); lista.append(f)
        }
      } catch (x) { err(x) }
    }
    let tm; q.oninput = () => { clearTimeout(tm); tm = setTimeout(pintar, 250) }; t.onchange = d.onchange = pintar; pintar()
  }
  N.historialCambio = () => {}

  // ================= tareas programadas =================
  vistas.programadas = async () => {
    const v = $('v-programadas'); v.replaceChildren()
    v.append(el('h1', '', 'Tareas programadas'), el('p', 'sub', 'Nova las ejecuta a su hora mientras esté abierta. Si estuvo cerrada, al abrir cumple lo vencido en las últimas 24 horas y reprograma lo repetido. Con el equipo apagado o suspendido no se ejecuta nada. Las «consultas» solo leen (internet); nunca modifican archivos ni envían mensajes.'))
    let proy = []; try { proy = (await api('/api/proyectos')).items } catch {}
    const f = el('form', 'caja'), g = el('div', 'campos')
    const campo = (et, nodo) => { const l = el('label', 'campo', et); l.append(nodo); return l }
    const tit = el('input'); tit.required = true; tit.maxLength = 120; tit.placeholder = 'Ej.: Revisar mi agenda'
    const tipo = el('select'); for (const [a, b] of [['recordatorio', 'Recordatorio hablado'], ['consulta', 'Consulta: Nova investiga y avisa']]) { const o = el('option', '', b); o.value = a; tipo.append(o) }
    const at = el('input'); at.type = 'datetime-local'; at.required = true
    const rep = el('select'); for (const [a, b] of Object.entries(REP)) { const o = el('option', '', b); o.value = a; rep.append(o) }
    const pr = el('select'); const o0 = el('option', '', 'Sin proyecto'); o0.value = ''; pr.append(o0); for (const p of proy) { const o = el('option', '', p.nombre); o.value = p.id; pr.append(o) }
    const desc = el('textarea'); desc.rows = 2; desc.maxLength = 600; desc.placeholder = 'Descripción o instrucción (obligatoria en una consulta: «resume las noticias de hoy»)'
    const ahora = new Date(Date.now() + 3600e3); ahora.setMinutes(0, 0, 0); at.value = new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    g.append(campo('Título', tit), campo('Tipo', tipo), campo('Fecha y hora', at), campo('Repetir', rep), campo('Proyecto', pr)); f.append(g, campo('Descripción', desc), el('button', 'btn', 'Programar'))
    f.onsubmit = async (e) => { e.preventDefault(); try { await api('/api/programadas', { method: 'POST', body: JSON.stringify({ titulo: tit.value, tipo: tipo.value, at: at.value + ':00', repeat: rep.value, proyecto: pr.value || null, descripcion: desc.value }) }); tit.value = ''; desc.value = ''; N.cargarRecs(); pintar() } catch (x) { err(x) } }
    const lista = el('div', 'lista'); v.append(f, lista)
    async function pintar() {
      lista.replaceChildren()
      try {
        const { items } = await api('/api/programadas'); const rs = (await api('/api/recordatorios')).items
        if (!items.length && !rs.length) lista.append(el('p', 'sub', 'No hay tareas. Programe la primera arriba, o dígale a Nova: «recuérdame estudiar mañana a las siete».'))
        for (const t of items) {
          const f2 = el('div', 'fila-item'), tx = el('div', 't'); tx.append(el('b', '', t.titulo)); tx.firstChild.style.fontWeight = '400'
          const [et, cl] = t.activo ? (t.estado === 'error' ? ESTADO_T.error : ESTADO_T.pendiente) : (ESTADO_T[t.estado] || ['Pausada', 'amb']); const m = el('small'); m.append(el('span', 'etq ' + cl, t.activo || t.estado !== 'pendiente' ? et : 'Pausada'), el('span', 'etq', t.tipo === 'consulta' ? 'consulta' : 'recordatorio'), document.createTextNode((t.activo ? 'Próxima: ' + fecha(t.at) : 'Última programación: ' + fecha(t.at)) + ' · ' + REP[t.repeat] + (t.proyecto ? ' · proyecto: ' + (proy.find((p) => p.id === t.proyecto)?.nombre ?? '—') : ''))); tx.append(m)
          if (t.descripcion) tx.append(el('small', '', t.descripcion))
          if (t.ultima) tx.append(el('small', t.ultima.estado === 'error' ? 'errMed' : '', 'Última ejecución: ' + fecha(t.ultima.ts) + ' · ' + t.ultima.estado + (t.ultima.detalle ? ' — ' + t.ultima.detalle.slice(0, 160) : '')))
          const acc = el('div', 'acc')
          acc.append(btn(t.activo ? 'Pausar' : 'Activar', () => api('/api/programadas/' + t.id, { method: 'PUT', body: JSON.stringify({ activo: !t.activo, ...(t.at < Date.now() && !t.activo ? { at: Date.now() + 3600e3 } : {}) }) }).then(() => { N.cargarRecs(); pintar() }).catch(err)))
          acc.append(btn(t.estado === 'error' ? 'Reintentar' : 'Ejecutar ahora', async (ev) => { ev.target.disabled = true; ev.target.textContent = 'Ejecutando…'; try { await api(`/api/programadas/${t.id}/ejecutar`, { method: 'POST', body: '{}' }) } catch (x) { err(x) } pintar() }))
          acc.append(btn('Editar', () => editar(f2, t)))
          acc.append(btn('Cancelar', () => confirmar(lista, `¿Cancelar «${t.titulo}»?`, () => api('/api/programadas/' + t.id, { method: 'DELETE' }).then(() => { N.cargarRecs(); pintar() }).catch(err)), 'pel'))
          f2.append(tx, acc)
          if (t.runs?.length > 1) { const det = el('details'), sm = el('summary', '', `Historial (${t.runs.length})`), h = el('ul', 'hist'); for (const r of t.runs) { const li = el('li'); li.append(el('span', r.estado === 'error' ? 'r-mal' : 'r-ok', fecha(r.ts) + ' ' + r.estado), el('b', '', (r.detalle || '').slice(0, 120))); h.append(li) } det.append(sm, h); tx.append(det) }
          lista.append(f2)
        }
        if (rs.length) { lista.append(el('h2', 'sub', 'Recordatorios pedidos a Nova por voz o chat')); for (const r of rs) { const f2 = el('div', 'fila-item'), tx = el('div', 't', r.text); tx.append(el('small', '', r.cuando + (r.repeat !== 'none' ? ' · ' + (r.repeat === 'daily' ? 'todos los días' : 'lunes a viernes') : ''))); f2.append(tx, btn('Cancelar', () => api('/api/recordatorios/' + r.id, { method: 'DELETE' }).then(() => { N.cargarRecs(); pintar() }).catch(err), 'pel')); lista.append(f2) } }
      } catch (x) { err(x) }
    }
    function editar(fila, t) {
      const f3 = el('form', 'caja'), ti = el('input'), de = el('textarea'), a = el('input'), rp = el('select'); ti.value = t.titulo; de.value = t.descripcion || ''; de.rows = 2; a.type = 'datetime-local'; a.value = new Date(t.at - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
      for (const [k, b] of Object.entries(REP)) { const o = el('option', '', b); o.value = k; rp.append(o) } rp.value = t.repeat
      const gg = el('div', 'campos'); gg.append(campo('Título', ti), campo('Fecha y hora', a), campo('Repetir', rp)); f3.append(gg, campo('Descripción', de), btn('Cancelar', () => f3.remove(), 'btn sec'), el('button', 'btn', 'Guardar'))
      f3.onsubmit = async (e) => { e.preventDefault(); try { await api('/api/programadas/' + t.id, { method: 'PUT', body: JSON.stringify({ titulo: ti.value, descripcion: de.value, at: a.value + ':00', repeat: rp.value, activo: true }) }); N.cargarRecs(); pintar() } catch (x) { err(x) } }
      fila.after(f3)
    }
    pintar()
  }
  window.Nova.cargarRecs?.()
})()
