'use strict';
// Galería de imágenes y videos: los resultados aparecen en cuanto responde cada fuente. Todo texto entra con textContent.
(() => {
  const $ = (id) => document.getElementById(id)
  const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x !== undefined) e.textContent = x; return e }
  const http = (u) => /^https?:\/\//i.test(u || '')
  const VERBO = /(busca(?:me)?|encuentra(?:me)?|mu[eé]stra(?:me)?|ens[eé][ñn]a(?:me)?|ver|quiero ver|dame|ponme|pon|trae(?:me)?|sac[ae](?:me)?)/i
  const RELLENO = /(?<![\p{L}])(una|unas|unos|un|las|los|la|el|me|de|del|sobre|acerca|referencias? visuales? (?:de|para)|que|explique[n]?|expliquen|muestre[n]?|im[aá]gen(?:es)?|fotos?|fotograf[ií]as?|ilustraci[oó]n(?:es)?|v[ií]deos?|videos?|clips?|diferentes|varios|algunos|algunas|tipos?|por favor)(?![\p{L}])/giu
  function detectar(texto) {
    const t = String(texto || '').trim(); if (t.length > 200 || !VERBO.test(t)) return null
    const m = t.match(/\b(im[aá]gen(?:es)?|fotos?|fotograf[ií]as?|ilustraci[oó]n(?:es)?|v[ií]deos?|videos?|clips?)\b/i); if (!m) return null
    const tipo = /v[ií]deo|clip/i.test(m[1]) ? 'video' : 'imagen'
    let q = t.replace(/^(?:por favor[, ]*|nova[, ]*)/i, '').replace(VERBO, ' ').replace(RELLENO, ' ').replace(/[¿?¡!.,]/g, ' ').replace(/\s+/g, ' ').trim()
    return q.length >= 2 ? { tipo, q } : null
  }
  // visor ampliado
  const visor = $('visor'), cont = $('visorCont'), pie = $('visorPie')
  const cerrar = () => { visor.hidden = true; cont.replaceChildren() }
  $('visorX').onclick = cerrar; visor.addEventListener('click', (e) => { if (e.target === visor) cerrar() })
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !visor.hidden) { cerrar(); e.stopPropagation() } }, true)
  function abrir(it) {
    cont.replaceChildren(); pie.replaceChildren()
    if (it.embed && http(it.embed)) { const f = el('iframe'); f.src = it.embed + '?autoplay=1&rel=0'; f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'; f.allowFullscreen = true; f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation'); f.title = it.titulo; cont.append(f) }
    else if (it.src && http(it.src)) { const v = el('video'); v.controls = true; v.autoplay = true; v.src = it.src; v.poster = http(it.thumb) ? it.thumb : ''; cont.append(v) }
    else { const i = el('img'); i.alt = it.titulo || ''; i.src = http(it.url) ? it.url : it.thumb; i.onerror = () => { if (i.src !== it.thumb && http(it.thumb)) i.src = it.thumb }; cont.append(i) }
    pie.append(document.createTextNode([it.titulo, it.autor, it.licencia, it.fuente].filter(Boolean).join(' · ') + ' '))
    if (http(it.pagina)) { const a = el('a', '', 'Abrir original'); a.href = it.pagina; a.target = '_blank'; a.rel = 'noopener noreferrer'; pie.append(a) }
    visor.hidden = false
  }
  function tarjeta(it) {
    if (it.tipo === 'enlace') { const a = el('a', 'tarj enlace', it.titulo); a.href = http(it.pagina) ? it.pagina : '#'; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a }
    const b = el('button', 'tarj'); b.type = 'button'; b.title = it.titulo || ''
    const i = el('img'); i.loading = 'lazy'; i.alt = it.titulo || ''; i.referrerPolicy = 'no-referrer'; if (http(it.thumb)) i.src = it.thumb; i.onerror = () => b.remove(); b.append(i)
    if (it.tipo === 'video') { const p = el('div', 'play'); p.append(el('i', '', '▶')); b.append(p) }
    b.append(el('div', 'pie', (it.titulo || '').slice(0, 70) + (it.fuente ? ' · ' + it.fuente : '')))
    b.onclick = () => abrir(it); return b
  }
  // crea el bloque de resultados dentro de un contenedor y devuelve controles
  function bloque(contenedor, titulo) {
    const d = el('div', 'medios'), cab = el('div', 'cab'), t = el('b', '', titulo), est = el('span', 'cargando', 'Buscando'), rej = el('div', 'rejilla')
    cab.append(t, est); d.append(cab, rej); contenedor.append(d)
    return { d, rej, estado: (x, mal) => { est.className = mal ? 'errMed' : ''; est.textContent = x }, anadir: (items) => { for (const it of items) rej.append(tarjeta(it)) } }
  }
  /** Busca y muestra. Devuelve { total, estado, id } al terminar. */
  async function buscar(tipo, q, contenedor, { proyecto, ctl } = {}) {
    const b = bloque(contenedor, (tipo === 'video' ? 'Videos: ' : 'Imágenes: ') + q)
    let total = 0, fin = null, error = ''
    try {
      const r = await fetch(`/api/medios?tipo=${tipo}&q=${encodeURIComponent(q)}${proyecto ? '&proyecto=' + proyecto : ''}`, { signal: ctl?.signal })
      if (r.status === 401) { location.reload(); return { total: 0 } }
      if (!r.ok || !r.body) throw new Error('No se pudo buscar.')
      const rd = r.body.getReader(), dec = new TextDecoder(); let resto = ''
      for (;;) {
        const { value, done } = await rd.read(); if (done) break
        resto += dec.decode(value, { stream: true }); const ps = resto.split('\n\n'); resto = ps.pop()
        for (const p of ps) { if (!p.startsWith('data: ')) continue; const ev = JSON.parse(p.slice(6))
          if (ev.t === 'items') { total += ev.items.filter((x) => x.tipo !== 'enlace').length; b.anadir(ev.items); b.estado(total + ' resultado' + (total === 1 ? '' : 's') + '…'); contenedor.scrollTop = contenedor.scrollHeight }
          else if (ev.t === 'fin') fin = ev; else if (ev.t === 'error') error = ev.message }
      }
    } catch (e) { if (e.name === 'AbortError') { b.estado('Cancelado'); return { total, estado: 'cancelado' } } error = e.message }
    if (error) { b.estado(error, true); return { total, estado: 'error' } }
    if (!total) { b.estado('Sin resultados', true); b.rej.replaceWith(el('p', 'vacioMed', fin?.errores?.length ? 'Las fuentes no respondieron ahora mismo. Intente de nuevo en un momento.' : 'No encontré resultados para esa búsqueda. Pruebe con otras palabras.')); return { total, estado: 'sin_resultados', id: fin?.id } }
    b.estado(`${total} resultado${total === 1 ? '' : 's'} · ${(fin?.fuentes || []).join(', ')}`)
    return { total, estado: 'ok', id: fin?.id }
  }
  /** Muestra resultados ya guardados (historial). */
  function mostrarGuardada(e, contenedor) { const b = bloque(contenedor, (e.tipo === 'video' ? 'Videos: ' : e.tipo === 'imagen' ? 'Imágenes: ' : 'Búsqueda: ') + e.q); b.anadir(e.resultados || []); b.estado(`${(e.resultados || []).length} guardados · ${new Date(e.ts).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}`); if (!(e.resultados || []).length) b.rej.replaceWith(el('p', 'vacioMed', e.tipo === 'web' ? 'Las búsquedas web guardan solo la consulta.' : 'Esta búsqueda no guardó resultados.')) }
  window.NovaMedios = { detectar, buscar, mostrarGuardada }
})()
