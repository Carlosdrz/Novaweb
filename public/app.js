'use strict'
const $ = (id) => document.getElementById(id)
const state = { msgs: [], busy: false, ctl: null, voz: true, serverVoz: false, escucha: false, wakeUntil: 0 }
const SR = window.SpeechRecognition || window.webkitSpeechRecognition

// ---------- acceso ----------
async function ping() { try { const r = await fetch('/api/ping'); return r.ok ? await r.json() : null } catch { return null } }
async function arrancar() {
  const p = await ping()
  if (!p) { $('login').hidden = false; $('app').hidden = true; return }
  $('login').hidden = true; $('app').hidden = false
  state.serverVoz = p.voz
  $('vozInfo').textContent = p.voz ? 'ElevenLabs' : 'Navegador'
  if (!SR) { $('mic').hidden = true; $('escBtn').hidden = true }
  vacio()
  cargarRecs(); setInterval(avisar, 15000); avisar()
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { avisar(); cargarRecs() } })
  document.addEventListener('pointerdown', desbloquear, { once: true })
  // Micrófono: si ya está permitido (o lo dejó activado), Nova escucha su nombre sin más pasos.
  let apagado = false; try { apagado = localStorage.getItem('nova-escucha') === '0' } catch {}
  if (SR && !apagado) activarEscucha(true)
}
async function cargarRecs() {
  try {
    const r = await fetch('/api/recordatorios'); if (!r.ok) return
    const { items } = await r.json(); const ul = $('recs'); ul.innerHTML = ''
    if (!items.length) { ul.innerHTML = '<li class="tenue">Ninguno</li>'; return }
    for (const it of items) { const li = document.createElement('li'); li.textContent = it.text; const s = document.createElement('small'); s.textContent = it.cuando + (it.repeat === 'daily' ? ' · diario' : it.repeat === 'weekdays' ? ' · lun-vie' : ''); li.append(s); ul.append(li) }
  } catch {}
}
async function avisar() {
  try {
    const r = await fetch('/api/avisos'); if (!r.ok) return
    const { avisos } = await r.json()
    for (const a of avisos) { burbuja('nova', a.text); decirYa(a.text) }
    if (avisos.length) cargarRecs()
  } catch {}
}
$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault(); $('loginErr').textContent = ''
  desbloquear()
  const r = await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: $('pw').value }) })
  if (r.ok) { $('pw').value = ''; arrancar() } else $('loginErr').textContent = (await r.json().catch(() => ({}))).error || 'No se pudo entrar.'
})
$('salir').onclick = async () => { await fetch('/api/logout', { method: 'POST' }); location.reload() }

// ---------- pantalla ----------
let orbeT = null
function orbe(s) {
  const o = $('orbe'); if (!o) return
  clearTimeout(orbeT)
  if (s === 'escuchando' || s === 'pensando' || s === 'hablando') { o.className = 'orbe on ' + s }
  else { orbeT = setTimeout(() => { o.className = 'orbe' }, 2500) }
}
function estado(s, txt) {
  orbe(s)
  $('punto').className = 'punto ' + s
  $('estadoTxt').textContent = txt
}
function aviso(t) { $('aviso').hidden = !t; $('aviso').textContent = t || '' }
function vacio() {
  const l = $('log'); l.innerHTML = ''
  const d = document.createElement('div'); d.className = 'vacio'
  d.innerHTML = '<div class="marca">NOVA</div><p>Pregúnteme lo que quiera, Señor. Puede escribir o usar el micrófono.</p>'
  l.append(d)
  state.msgs = []; $('cuenta').textContent = '0'
}
function burbuja(rol, texto) {
  const l = $('log'); l.querySelector('.vacio')?.remove()
  const d = document.createElement('div'); d.className = 'msg ' + (rol === 'user' ? 'u' : 'n'); d.textContent = texto
  l.append(d); l.scrollTop = l.scrollHeight
  return d
}
$('nuevo').onclick = () => { detener(); vacio(); aviso('') }
$('vozBtn').onclick = () => { state.voz = !state.voz; $('vozBtn').classList.toggle('on', state.voz); $('vozBtn').setAttribute('aria-pressed', state.voz); if (!state.voz) callar() }

// ---------- voz de salida ----------
const player = new Audio()
let cola = [], hablando = false, genVoz = 0
function desbloquear() {
  try { if (!window.__conectado) { window.__conectado = true; window.novaConectarAudio?.(player) } } catch {}
  try { window.__novaAC?.resume() } catch {}
  try { player.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='; player.play().catch(() => {}) } catch {}
  try { speechSynthesis.getVoices() } catch {}
}
function vozEs() {
  const vs = speechSynthesis.getVoices().filter((v) => /^es/i.test(v.lang))
  return vs.find((v) => /es-(DO|MX|US|419)/i.test(v.lang)) || vs[0] || null
}
function sintetizar(texto, g) {
  return new Promise((ok) => {
    try {
      const u = new SpeechSynthesisUtterance(texto); u.lang = 'es-DO'; const v = vozEs(); if (v) u.voice = v
      u.onend = u.onerror = () => ok(); speechSynthesis.speak(u)
    } catch { ok() }
  })
}
async function pedirAudio(texto) {
  const r = await fetch('/api/tts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: texto }) })
  if (!r.ok) throw new Error('tts')
  return URL.createObjectURL(await r.blob())
}
function reproducir(url) {
  return new Promise((ok, mal) => { player.onended = () => { URL.revokeObjectURL(url); ok() }; player.onerror = () => mal(new Error('audio')); player.src = url; player.play().catch(mal) })
}
function decir(texto) {
  if (!state.voz || !texto.trim()) return
  const item = { texto, url: state.serverVoz ? pedirAudio(texto).catch(() => null) : Promise.resolve(null) }
  cola.push(item); if (!hablando) bombear(++genVoz)
}
async function bombear(g) {
  hablando = true; estado('hablando', 'Hablando'); pararEscucha(true)
  while (cola.length && g === genVoz) {
    const it = cola.shift(); const url = await it.url
    if (g !== genVoz) break
    try { if (url) await reproducir(url); else await sintetizar(it.texto, g) } catch { await sintetizar(it.texto, g) }
  }
  if (g === genVoz) { hablando = false; fin() }
}
function callar() { genVoz++; cola = []; hablando = false; try { player.pause() } catch {} try { speechSynthesis.cancel() } catch {} }
function fin() { if (!state.busy) { estado('', 'En línea'); if (state.escucha) iniciarEscucha() } }

// ---------- chat ----------
async function enviar(texto) {
  texto = texto.trim(); if (!texto) return
  if (state.busy) detener()
  aviso(''); callar()
  state.msgs.push({ role: 'user', content: texto }); burbuja('user', texto)
  $('cuenta').textContent = state.msgs.length
  const b = burbuja('n', ''); b.classList.add('act')
  state.busy = true; $('enviar').hidden = true; $('parar').hidden = false; estado('pensando', 'Pensando')
  const ctl = new AbortController(); state.ctl = ctl
  const t0 = performance.now(); let primero = false, acc = '', buf = '', pend = ''
  const soltar = (todo) => {
    pend += buf; buf = ''
    for (;;) {
      const m = pend.match(/^([\s\S]{20,}?[.!?…:](?=\s)|[\s\S]*?\n)/)
      if (!m) break
      decir(m[0].trim()); pend = pend.slice(m[0].length)
    }
    if (todo && pend.trim()) { decir(pend.trim()); pend = '' }
  }
  try {
    const r = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: state.msgs }), signal: ctl.signal })
    if (r.status === 401) { location.reload(); return }
    if (!r.ok || !r.body) throw new Error((await r.json().catch(() => ({}))).error || 'Error de conexión.')
    const rd = r.body.getReader(), dec = new TextDecoder(); let resto = ''
    for (;;) {
      const { value, done } = await rd.read(); if (done) break
      resto += dec.decode(value, { stream: true })
      const partes = resto.split('\n\n'); resto = partes.pop()
      for (const p of partes) {
        if (!p.startsWith('data: ')) continue
        const ev = JSON.parse(p.slice(6))
        if (ev.t === 'text') {
          if (!primero) { primero = true; $('lat').textContent = ((performance.now() - t0) / 1000).toFixed(1) + ' s'; estado('hablando', 'Respondiendo') }
          acc += ev.text; buf += ev.text; b.textContent = acc; $('log').scrollTop = $('log').scrollHeight; soltar(false)
        } else if (ev.t === 'error') throw new Error(ev.message)
      }
    }
    soltar(true)
    if (acc.trim()) { state.msgs.push({ role: 'assistant', content: acc.trim() }); $('cuenta').textContent = state.msgs.length }
    else { b.textContent = 'No obtuve respuesta. Intente de nuevo.' }
  } catch (e) {
    if (e.name !== 'AbortError') { aviso(e.message || 'Fallo al responder.'); if (!acc) b.remove() }
    else if (acc.trim()) state.msgs.push({ role: 'assistant', content: acc.trim() })
  } finally {
    cargarRecs(); b.classList.remove('act'); state.busy = false; state.ctl = null
    $('enviar').hidden = false; $('parar').hidden = true
    if (!hablando) fin()
  }
}
function detener() { state.ctl?.abort(); callar(); estado('', 'En línea') }
$('parar').onclick = detener
$('form').addEventListener('submit', (e) => { e.preventDefault(); desbloquear(); const t = $('txt').value; $('txt').value = ''; enviar(t) })

// ---------- micrófono ----------
let rec = null, modo = null // 'uno' | 'cont'
function crearRec(continuo) {
  const r = new SR(); r.lang = 'es-DO'; r.continuous = continuo; r.interimResults = true
  return r
}
function pararEscucha(silencioso) {
  if (rec) { const r = rec; rec = null; r.onend = null; try { r.abort() } catch {} }
  $('mic').classList.remove('on')
  if (!silencioso && !state.busy && !hablando) estado('', 'En línea')
}
function escuchaUna() {
  if (!SR) return
  desbloquear(); detener(); pararEscucha(true); modo = 'uno'
  const r = crearRec(false); rec = r; let final = ''
  r.onresult = (e) => { let t = ''; for (const x of e.results) t += x[0].transcript; $('txt').value = t; if (e.results[e.results.length - 1].isFinal) final = t }
  r.onerror = (e) => { if (e.error === 'not-allowed') aviso('Permita el micrófono en el navegador para hablar con Nova.'); else if (e.error !== 'no-speech' && e.error !== 'aborted') aviso('No pude escuchar. Intente de nuevo.') }
  r.onend = () => { rec = null; $('mic').classList.remove('on'); const t = (final || $('txt').value).trim(); $('txt').value = ''; if (t) enviar(t); else if (!state.busy) estado('', 'En línea') }
  try { r.start(); $('mic').classList.add('on'); estado('escuchando', 'Escuchando') } catch { aviso('El micrófono no está disponible.') }
}
$('mic').addEventListener('click', iniciarClap)
$('mic').onclick = () => { if (rec && modo === 'uno') { try { rec.stop() } catch {} } else escuchaUna() }

const NOMBRE = /^\s*(?:oye|hola|hey|ok|okay)?[\s,]*nova\b[\s,.:!?-]*/i
function iniciarEscucha() {
  if (!SR || rec || hablando) return
  modo = 'cont'
  const r = crearRec(true); rec = r
  r.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (!e.results[i].isFinal) continue
      const t = e.results[i][0].transcript.trim(); if (!t) continue
      const ventana = Date.now() < state.wakeUntil
      if (NOMBRE.test(t)) {
        const resto = t.replace(NOMBRE, '').trim()
        if (resto) { state.wakeUntil = 0; enviar(resto) } else { state.wakeUntil = Date.now() + 12000; estado('escuchando', 'Dígame'); decirYa('Dígame, Señor.') }
      } else if (ventana) { state.wakeUntil = 0; enviar(t) }
    }
  }
  r.onerror = (e) => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { state.escucha = false; $('escBtn').classList.remove('on'); aviso('Permita el micrófono en el navegador para que Nova escuche su nombre.') } }
  r.onend = () => { rec = null; if (state.escucha && !hablando && !state.busy) setTimeout(iniciarEscucha, 300) }
  try { r.start(); if (!state.busy) estado('espera', 'Esperando «Nova»') } catch {}
}
function decirYa(t) { const v = state.voz; state.voz = true; decir(t); state.voz = v }
function activarEscucha(on) {
  if (on) iniciarClap()
  state.escucha = on
  $('escBtn').classList.toggle('on', on); $('escBtn').setAttribute('aria-pressed', on)
  try { localStorage.setItem('nova-escucha', on ? '1' : '0') } catch {}
  if (on) iniciarEscucha(); else pararEscucha(false)
}
$('escBtn').onclick = () => { desbloquear(); activarEscucha(!state.escucha) }

// ---------- aplauso ----------
let clapIniciado = false
async function iniciarClap() {
  if (clapIniciado || !navigator.mediaDevices?.getUserMedia) return
  clapIniciado = true
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false } })
    const ac = new (window.AudioContext || window.webkitAudioContext)(); const an = ac.createAnalyser(); an.fftSize = 1024
    ac.createMediaStreamSource(s).connect(an)
    const buf = new Float32Array(an.fftSize); let floor = 0.01, prev = 0, ultimo = 0
    window.__clap = { rms: 0, floor: 0 }
    setInterval(() => {
      if (ac.state === 'suspended') ac.resume().catch(() => {})
      an.getFloatTimeDomainData(buf)
      let sum = 0, pk = 0; for (const v of buf) { sum += v * v; const a = Math.abs(v); if (a > pk) pk = a }
      const rms = Math.sqrt(sum / buf.length), crest = pk / (rms + 1e-6), t = Date.now()
      const golpe = rms > Math.max(0.06, floor * 8) && crest > 3.2 && prev < rms * 0.45 && t - ultimo > 1500 && !hablando
      if (golpe) { ultimo = t; despertar() } else floor = floor * 0.98 + Math.min(rms, 0.05) * 0.02
      prev = rms; window.__clap.rms = rms; window.__clap.floor = floor
    }, 20)
  } catch { clapIniciado = false }
}
function despertar() {
  if (state.busy) detener()
  if (SR) escuchaUna(); else { estado('escuchando', 'Dígame'); $('txt').focus() }
}

arrancar()
