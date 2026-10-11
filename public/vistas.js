'use strict';
// Secciones de Nova: conversaciones, memoria, herramientas, automatizaciones y configuración.
// Todo el texto del usuario entra con textContent (nunca innerHTML).
(() => {
  const N = window.Nova, $ = (id) => document.getElementById(id), api = N.api
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e }
  const fecha = (t) => new Date(t).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })
  const VISTAS = ['inicio', 'conversaciones', 'memoria', 'herramientas', 'automatizaciones', 'configuracion']
  const alFallar = (e) => N.aviso(e.message)

  function ir(v) {
    for (const x of VISTAS) { const s = $(x === 'inicio' ? 'v-inicio' : 'v-' + x); s.hidden = x !== v; s.classList.toggle('on', x === v && x === 'inicio') }
    $('der').hidden = v !== 'inicio'
    document.querySelectorAll('#tabs .tab').forEach((b) => b.classList.toggle('on', b.dataset.v === v))
    ;({ conversaciones: pintarConv, memoria: pintarMem, herramientas: pintarHerr, automatizaciones: pintarAuto, configuracion: pintarConf })[v]?.()
  }
  N.ir = ir
  $('tabs').addEventListener('click', (e) => { const b = e.target.closest('.tab'); if (b) ir(b.dataset.v) })

  // ---- conversaciones
  async function pintarConv() {
    const l = $('lConv'); l.replaceChildren()
    try {
      const { items } = await api('/api/conversaciones')
      if (!items.length) l.append(el('p', 'sub', 'Aún no hay conversaciones guardadas.'))
      for (const c of items) {
        const f = el('div', 'fila-item'), t = el('div', 't', c.titulo); t.append(el('small', '', fecha(c.actualizada)))
        const ab = el('button', '', 'Abrir'), bo = el('button', 'pel', 'Borrar')
        ab.onclick = async () => { try { const d = await api('/api/conversaciones/' + c.id); abrirConv(d); ir('inicio') } catch (e) { alFallar(e) } }
        bo.onclick = async () => { await api('/api/conversaciones/' + c.id, { method: 'DELETE' }); if (N.state.convId === c.id) N.state.convId = null; pintarConv() }
        f.append(t, ab, bo); l.append(f)
      }
    } catch (e) { alFallar(e) }
  }
  function abrirConv(d) {
    $('nuevo').click(); N.state.convId = d.id
    const log = $('log'); log.replaceChildren(); N.state.msgs = d.msgs.slice()
    for (const m of d.msgs) { const b = el('div', 'msg ' + (m.role === 'user' ? 'u' : 'n')); const tx = el('span', 'tx', m.content); b.append(tx); log.append(b) }
    log.scrollTop = log.scrollHeight
  }

  // ---- memoria
  async function pintarMem() {
    const l = $('lMem'); l.replaceChildren()
    try {
      const { activa, items } = await api('/api/memoria')
      document.querySelector('#v-memoria [data-permiso]').checked = activa
      if (!items.length) l.append(el('p', 'sub', 'Nova todavía no recuerda nada de usted.'))
      items.forEach((txt, i) => {
        const f = el('div', 'fila-item'), t = el('div', 't', txt.replace(/\s\(\d{4}-\d{2}-\d{2}\)$/, '')); t.append(el('small', '', (txt.match(/\((\d{4}-\d{2}-\d{2})\)$/) ?? [])[1] ?? ''))
        const ed = el('button', '', 'Editar'), bo = el('button', 'pel', 'Borrar')
        ed.onclick = async () => { const n = prompt('Corregir el recuerdo:', t.firstChild.textContent); if (n) { try { await api('/api/memoria/' + i, { method: 'PUT', body: JSON.stringify({ texto: n }) }); pintarMem() } catch (e) { alFallar(e) } } }
        bo.onclick = async () => { if (confirm('¿Borrar este recuerdo?')) { await api('/api/memoria/' + i, { method: 'DELETE' }); pintarMem() } }
        f.append(t, ed, bo); l.append(f)
      })
    } catch (e) { alFallar(e) }
  }
  $('fMem').addEventListener('submit', async (e) => { e.preventDefault(); const v = $('memTxt').value; if (!v.trim()) return; try { await api('/api/memoria', { method: 'POST', body: JSON.stringify({ texto: v }) }); $('memTxt').value = ''; pintarMem() } catch (x) { alFallar(x) } })

  // ---- permisos (interruptores compartidos por Memoria y Herramientas)
  const PERMISOS = [
    ['web', 'Internet', 'Buscar y leer páginas web para responder con datos actuales.', 'Requiere internet'],
    ['consejo', 'Consejo de IAs', 'Para preguntas importantes, consulta en paralelo a varios especialistas (investigador web, analista, verificador de riesgos, Wikipedia y otras IAs conectadas) y combina lo mejor. Gasta más de su plan de Claude y tarda unos segundos más.', 'Requiere internet'],
    ['agenda', 'Recordatorios', 'Programar recordatorios y rutinas que Nova dice en voz alta.', 'Local'],
    ['memoria', 'Memoria', 'Recordar lo que usted autoriza guardar.', 'Local'],
    ['notas', 'Notas y tareas', 'Crear y consultar notas y listas de tareas.', 'Local'],
    ['abrirUrls', 'Abrir páginas web', 'Abrir un enlace en su navegador (siempre pide confirmación).', 'Solo al ejecutar Nova en su equipo'],
    ['abrirApps', 'Abrir aplicaciones', 'Abrir solo las aplicaciones que usted marque en Configuración.', 'Solo al ejecutar Nova en su equipo'],
    ['buscarArchivos', 'Buscar archivos', 'Buscar nombres de archivos dentro de las carpetas autorizadas.', 'Solo al ejecutar Nova en su equipo'],
    ['leerArchivos', 'Leer archivos', 'Leer archivos de texto o código de las carpetas autorizadas. Su contenido se trata como datos, nunca como órdenes.', 'Solo al ejecutar Nova en su equipo'],
    ['crearArchivos', 'Crear archivos', 'Crear archivos nuevos en la carpeta de Nova (nunca sobrescribe; pide confirmación).', 'Solo al ejecutar Nova en su equipo'],
    ['casa', 'Hogar inteligente', 'Luces, interruptores y ventiladores vía Home Assistant.', 'Requiere Home Assistant (HA_URL y HA_TOKEN en el servidor)'],
  ]
  async function guardarPermiso(clave, v) { try { const aj = await api('/api/ajustes', { method: 'PUT', body: JSON.stringify({ permisos: { [clave]: v } }) }); N.aplicarAjustes(aj) } catch (e) { alFallar(e) } }
  document.querySelector('#v-memoria [data-permiso]').addEventListener('change', (e) => guardarPermiso('memoria', e.target.checked))

  async function pintarHerr() {
    const cont = $('lPerm'); cont.replaceChildren()
    try {
      const e = await api('/api/estado'); N.aplicarAjustes(e.ajustes); const p = e.ajustes.permisos
      for (const [k, tit, desc, req] of PERMISOS) {
        const solo = req.startsWith('Solo') && !e.local, ha = k === 'casa' && !e.casa
        const c = el('div', 'caja perm'), sw = el('label', 'sw'), i = el('input'); i.type = 'checkbox'; i.checked = p[k]; i.disabled = solo || ha
        i.addEventListener('change', () => guardarPermiso(k, i.checked)); sw.append(i, el('span', '', tit))
        c.append(sw, el('div', 'd', desc), el('div', 'req', solo ? 'No disponible aquí: ' + req.toLowerCase() : ha ? 'No configurado: ' + req : req)); cont.append(c)
      }
    } catch (x) { alFallar(x) }
    pintarNotas(); pintarTareas(); pintarAct()
  }
  async function pintarNotas() {
    const l = $('lNotas'); l.replaceChildren()
    try { for (const n of (await api('/api/notas')).items) { const f = el('li', 'fila-item'); f.append(el('div', 't', n.texto)); const b = el('button', 'pel', '✕'); b.setAttribute('aria-label', 'Borrar nota'); b.onclick = async () => { await api('/api/notas/' + n.id, { method: 'DELETE' }); pintarNotas() }; f.append(b); l.append(f) } } catch (e) { alFallar(e) }
    if (!l.children.length) l.append(el('li', 'sub peq', 'Sin notas.'))
  }
  async function pintarTareas() {
    const l = $('lTareas'); l.replaceChildren()
    try {
      for (const t of (await api('/api/tareas')).items) {
        const f = el('li', 'fila-item' + (t.hecha ? ' hecha' : '')), c = el('input'); c.type = 'checkbox'; c.checked = t.hecha; c.setAttribute('aria-label', 'Hecha')
        c.onchange = async () => { await api('/api/tareas/' + t.id, { method: 'PUT', body: JSON.stringify({ hecha: c.checked }) }); pintarTareas() }
        const x = el('div', 't', t.texto); if (t.vence) x.append(el('small', '', t.vence))
        const b = el('button', 'pel', '✕'); b.setAttribute('aria-label', 'Borrar tarea'); b.onclick = async () => { await api('/api/tareas/' + t.id, { method: 'DELETE' }); pintarTareas() }
        f.append(c, x, b); l.append(f)
      }
    } catch (e) { alFallar(e) }
    if (!l.children.length) l.append(el('li', 'sub peq', 'Sin tareas.'))
  }
  async function pintarAct() {
    const l = $('lAct'); l.replaceChildren()
    try {
      const { items } = await api('/api/actividad')
      if (!items.length) l.append(el('li', '', 'Todavía no hay acciones registradas.'))
      for (const a of items) { const li = el('li'); const bien = /^(ok|aprobada)$/.test(a.resultado); li.append(el('span', '', fecha(a.t)), el('b', '', a.detalle || a.accion), el('span', bien ? 'r-ok' : 'r-mal', a.resultado)); l.append(li) }
    } catch (e) { alFallar(e) }
  }
  $('fNota').addEventListener('submit', async (e) => { e.preventDefault(); const v = $('notaTxt').value; if (!v.trim()) return; try { await api('/api/notas', { method: 'POST', body: JSON.stringify({ texto: v }) }); $('notaTxt').value = ''; pintarNotas() } catch (x) { alFallar(x) } })
  $('fTarea').addEventListener('submit', async (e) => { e.preventDefault(); const v = $('tareaTxt').value; if (!v.trim()) return; try { await api('/api/tareas', { method: 'POST', body: JSON.stringify({ texto: v }) }); $('tareaTxt').value = ''; pintarTareas() } catch (x) { alFallar(x) } })

  // ---- automatizaciones
  async function pintarAuto() {
    const l = $('lRec'); l.replaceChildren()
    try {
      const { items } = await api('/api/recordatorios')
      if (!items.length) l.append(el('p', 'sub', 'No hay recordatorios programados.'))
      for (const r of items) {
        const f = el('div', 'fila-item'), t = el('div', 't', r.text); t.append(el('small', '', r.cuando + (r.repeat === 'daily' ? ' · todos los días' : r.repeat === 'weekdays' ? ' · lunes a viernes' : '')))
        const b = el('button', 'pel', 'Cancelar'); b.onclick = async () => { await api('/api/recordatorios/' + r.id, { method: 'DELETE' }); pintarAuto(); N.cargarRecs() }
        f.append(t, b); l.append(f)
      }
    } catch (e) { alFallar(e) }
  }
  $('fRec').addEventListener('submit', async (e) => {
    e.preventDefault()
    try { await api('/api/recordatorios', { method: 'POST', body: JSON.stringify({ text: $('recTxt').value, at: $('recAt').value + ':00', repeat: $('recRep').value }) }); $('recTxt').value = ''; pintarAuto(); N.cargarRecs() } catch (x) { alFallar(x) }
  })

  // ---- configuración
  async function pintarConf() {
    try {
      const e = await api('/api/estado'), a = e.ajustes; N.aplicarAjustes(a)
      $('cfgNombre').value = a.nombre; $('cfgIdioma').value = a.idioma; $('cfgVoz').checked = a.voz
      const lc = $('lCarp'); lc.replaceChildren()
      if (!e.local) lc.append(el('li', 'sub peq', 'Disponible al ejecutar Nova en su computadora.'))
      for (const c of a.carpetas) { const f = el('li', 'fila-item'); f.append(el('div', 't', c)); const b = el('button', 'pel', 'Quitar'); b.onclick = () => guardarAjustes({ carpetas: a.carpetas.filter((x) => x !== c) }); f.append(b); lc.append(f) }
      const sg = $('sugCarp'); sg.replaceChildren()
      for (const s of e.sugeridas.filter((s) => !a.carpetas.includes(s))) { const b = el('button', 'btn sec', '+ ' + s.split(/[\\/]/).pop()); b.title = s; b.onclick = () => guardarAjustes({ carpetas: [...a.carpetas, s] }); sg.append(b) }
      $('fCarp').hidden = !e.local; const ap = $('lApps'); ap.replaceChildren()
      if (!e.local) ap.append(el('p', 'sub peq', 'Disponible al ejecutar Nova en su computadora.'))
      else for (const n of e.apps) { const lab = el('label'), i = el('input'); i.type = 'checkbox'; i.checked = a.apps.includes(n); i.onchange = () => guardarAjustes({ apps: e.apps.filter((x) => (x === n ? i.checked : a.apps.includes(x))) }); lab.append(i, el('span', '', n)); ap.append(lab) }
      const lc2 = $('lCon'); lc2.replaceChildren()
      for (const [n, v] of [['Claude (cerebro)', 'sesión del servidor'], ['Voz de ElevenLabs', e.voz ? 'conectada' : 'no configurada: usa la voz del navegador'], ['Otras IAs (OpenAI / Gemini)', e.ias.length ? 'conectadas: ' + e.ias.join(', ') : 'sin clave: el consejo usa solo Claude + Wikipedia'], ['Home Assistant', e.casa ? 'conectado' : 'no configurado'], ['Control del equipo', e.local ? 'disponible' : 'no disponible en esta instalación']]) { const f = el('li', 'fila-item'); const t = el('div', 't', n); t.append(el('small', '', v)); f.append(t); lc2.append(f) }
    } catch (x) { alFallar(x) }
  }
  async function guardarAjustes(p) { try { N.aplicarAjustes(await api('/api/ajustes', { method: 'PUT', body: JSON.stringify(p) })); pintarConf() } catch (e) { alFallar(e) } }
  $('cfgNombre').addEventListener('change', () => guardarAjustes({ nombre: $('cfgNombre').value }))
  $('cfgIdioma').addEventListener('change', () => guardarAjustes({ idioma: $('cfgIdioma').value }))
  $('cfgVoz').addEventListener('change', () => guardarAjustes({ voz: $('cfgVoz').checked }))
  $('fCarp').addEventListener('submit', (e) => { e.preventDefault(); const v = $('carpTxt').value.trim(); if (v) { guardarAjustes({ carpetas: [...N.state.aj.carpetas, v] }); $('carpTxt').value = '' } })
})()
