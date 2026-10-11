'use strict';
// Holograma de Nova: capas de imagen contrarrotantes + anillos HUD, partículas, ondas y barrido en canvas.
// Reacciona al estado (escuchando / pensando / hablando) y al nivel de audio de la voz.
(() => {
  const orbe = document.getElementById('orbe'); if (!orbe) return
  const cv = document.getElementById('fx'), cx = cv.getContext('2d')
  const imgA = orbe.querySelector('.capa.a'), imgB = orbe.querySelector('.capa.b')
  let estado = 'reposo', activo = false, raf = 0, t0 = performance.now(), W = 0, H = 0
  const P = { velAnillo: 0.2, energia: 0.15, tono: 150, brillo: 1 }
  const META = {
    reposo:    { velAnillo: 0.15, energia: 0.12, tono: 150 },
    escuchando:{ velAnillo: 0.5,  energia: 0.45, tono: 170 },
    pensando:  { velAnillo: 2.4,  energia: 1,    tono: 135 },
    ejecutando:{ velAnillo: 1.6,  energia: 0.85, tono: 175 },
    hablando:  { velAnillo: 0.8,  energia: 0.7,  tono: 150 },
    error:     { velAnillo: 0.08, energia: 0.3,  tono: 2 },
  }
  // nivel de audio de la voz (ElevenLabs): analizador opcional
  let an = null, datos = null
  window.novaConectarAudio = (el) => {
    try {
      const AC = window.AudioContext || window.webkitAudioContext
      const ac = window.__novaAC || (window.__novaAC = new AC())
      const src = ac.createMediaElementSource(el); an = ac.createAnalyser(); an.fftSize = 256
      src.connect(an); an.connect(ac.destination); datos = new Uint8Array(an.frequencyBinCount)
      if (ac.state === 'suspended') ac.resume()
    } catch { an = null }
  }
  const nivel = (t) => {
    if (an) { an.getByteFrequencyData(datos); let s = 0; for (let i = 2; i < 40; i++) s += datos[i]; const v = s / 38 / 255; if (v > 0.02) return Math.min(1, v * 2.2) }
    return estado === 'hablando' ? 0.35 + 0.25 * Math.sin(t * 9) * Math.sin(t * 3.7) : 0
  }
  const resize = () => {
    const r = orbe.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2.5)
    W = Math.max(2, Math.round(r.width * d)); H = Math.max(2, Math.round(r.height * d))
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H }
  }
  // partículas orbitales
  const N = 260, ps = Array.from({ length: N }, () => ({ a: Math.random() * 6.283, r: 0.18 + Math.random() * 0.62, v: (0.05 + Math.random() * 0.25) * (Math.random() < 0.5 ? -1 : 1), s: 0.6 + Math.random() * 1.8, f: Math.random() * 6.283 }))
  const anillos = [
    { r: 0.93, w: 1.2, dash: [2, 14], v: 0.10, a: 0.55 },
    { r: 0.86, w: 2.2, dash: [90, 40, 20, 40], v: -0.18, a: 0.75 },
    { r: 0.78, w: 1, dash: [3, 7], v: 0.32, a: 0.6 },
    { r: 0.69, w: 3, dash: [140, 90], v: -0.5, a: 0.7 },
    { r: 0.58, w: 1.4, dash: [10, 6, 2, 6], v: 0.8, a: 0.65 },
    { r: 0.46, w: 2, dash: [60, 120], v: -1.1, a: 0.55 },
  ]
  const ondas = []; let ultOnda = 0, giro = 0, giro2 = 0, fase = 0
  const col = (a, l = 62) => `hsla(${P.tono},100%,${l}%,${a})`

  function cuadro(now) {
    raf = requestAnimationFrame(cuadro)
    const t = (now - t0) / 1000, dt = Math.min(0.05, (now - (cuadro.p || now)) / 1000); cuadro.p = now
    const m = META[estado] || META.reposo, k = 1 - Math.pow(0.001, dt)
    for (const q in m) P[q] += (m[q] - P[q]) * Math.min(1, k * 2.2)
    const lv = nivel(t), E = P.energia
    giro += dt * P.velAnillo * 0.25; giro2 -= dt * (0.04 + P.velAnillo * 0.18); fase += dt * (1 + E * 3)
    imgA.style.transform = `rotate(${giro * 57.3 * 0.35}deg) scale(${1 + 0.02 * Math.sin(t * 1.3) + lv * 0.05 + (estado === 'pensando' ? 0.02 * Math.sin(t * 7) : 0)})`
    imgB.style.transform = `rotate(${giro2 * 57.3}deg) scale(1.1)`
    imgA.style.filter = `hue-rotate(${P.tono - 210}deg) brightness(${1 + E * 0.18 + lv * 0.25}) saturate(${1 + E * 0.25})`
    imgB.style.filter = `hue-rotate(${P.tono - 210}deg)`
    resize(); const R = W / 2, c = R
    cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, W, H)
    cx.globalCompositeOperation = 'lighter'
    // núcleo luminoso
    const g = cx.createRadialGradient(c, c, 0, c, c, R * (0.28 + 0.1 * E + 0.12 * lv))
    g.addColorStop(0, col(0.55 + 0.35 * E + 0.3 * lv, 85)); g.addColorStop(0.4, col(0.18 + 0.2 * E, 60)); g.addColorStop(1, col(0))
    cx.fillStyle = g; cx.fillRect(0, 0, W, H)
    // anillos HUD
    for (const [i, a] of anillos.entries()) {
      cx.save(); cx.translate(c, c); cx.rotate(t * a.v * (0.4 + P.velAnillo * 0.6) + i)
      cx.lineWidth = a.w * (W / 900); cx.setLineDash(a.dash.map((d) => d * (W / 900)))
      cx.strokeStyle = col(a.a * (0.35 + 0.65 * (0.4 + E)) , 65)
      cx.shadowColor = col(0.9); cx.shadowBlur = 8 * (W / 900)
      cx.beginPath(); cx.arc(0, 0, R * a.r * (1 + lv * 0.012 * (i + 1)), 0, 6.283); cx.stroke(); cx.restore()
    }
    // marcas de grados giratorias
    cx.save(); cx.translate(c, c); cx.rotate(-t * 0.12 * (1 + P.velAnillo)); cx.setLineDash([]); cx.strokeStyle = col(0.5 + 0.3 * E, 70); cx.lineWidth = 1.2 * (W / 900)
    for (let i = 0; i < 120; i++) { const an2 = i / 120 * 6.283, l = i % 10 === 0 ? 0.035 : 0.014; cx.beginPath(); cx.moveTo(Math.cos(an2) * R * 0.965, Math.sin(an2) * R * 0.965); cx.lineTo(Math.cos(an2) * R * (0.965 - l), Math.sin(an2) * R * (0.965 - l)); cx.stroke() }
    cx.restore()
    // partículas
    for (const p of ps) {
      p.a += dt * p.v * (0.6 + P.velAnillo * 1.1)
      let rr = p.r
      if (estado === 'pensando') rr = p.r * (0.55 + 0.45 * Math.abs(Math.sin(fase * 0.6 + p.f)))   // convergen y se expanden como sinapsis
      else if (estado === 'hablando') rr = p.r * (1 + lv * 0.18 * Math.sin(p.f + t * 6))
      const x = c + Math.cos(p.a) * rr * R * 0.95, y = c + Math.sin(p.a) * rr * R * 0.95 * (0.92 + 0.08 * Math.sin(p.f))
      const tw = 0.5 + 0.5 * Math.sin(t * 3 + p.f)
      cx.fillStyle = col((0.25 + 0.6 * tw) * (0.4 + E), 78)
      cx.beginPath(); cx.arc(x, y, p.s * (W / 900) * (1 + E), 0, 6.283); cx.fill()
    }
    // arcos neuronales al pensar
    if (estado === 'pensando') {
      cx.lineWidth = 1.2 * (W / 900); cx.setLineDash([])
      for (let i = 0; i < 9; i++) {
        const a1 = fase * 0.9 + i * 0.7, a2 = a1 + 1.4 + Math.sin(t * 2 + i), r1 = R * (0.3 + 0.35 * ((i * 37) % 10) / 10)
        const x1 = c + Math.cos(a1) * r1, y1 = c + Math.sin(a1) * r1, x2 = c + Math.cos(a2) * r1 * 1.25, y2 = c + Math.sin(a2) * r1 * 1.25
        cx.strokeStyle = col(0.18 + 0.25 * Math.abs(Math.sin(t * 3 + i)), 75)
        cx.beginPath(); cx.moveTo(x1, y1); cx.quadraticCurveTo(c, c, x2, y2); cx.stroke()
      }
    }
    // ondas de energía al hablar / escuchar
    if ((estado === 'hablando' || estado === 'escuchando') && t - ultOnda > (estado === 'hablando' ? 0.55 - lv * 0.3 : 0.9)) { ultOnda = t; ondas.push({ t, a: estado === 'hablando' ? 0.5 + lv * 0.4 : 0.35, in: estado === 'escuchando' }) }
    for (let i = ondas.length - 1; i >= 0; i--) {
      const o = ondas[i], u = (t - o.t) / 1.8; if (u >= 1) { ondas.splice(i, 1); continue }
      const rr = o.in ? 1 - u : u
      cx.setLineDash([]); cx.lineWidth = 2 * (W / 900); cx.strokeStyle = col(o.a * (1 - u), 70)
      cx.beginPath(); cx.arc(c, c, R * (0.15 + 0.8 * rr), 0, 6.283); cx.stroke()
    }
    // barrido de escaneo
    const sy = ((t * (0.25 + P.velAnillo * 0.3)) % 1.4 - 0.2) * H
    const sg = cx.createLinearGradient(0, sy - H * 0.06, 0, sy + H * 0.02)
    sg.addColorStop(0, col(0)); sg.addColorStop(0.85, col(0.12 + 0.12 * E, 70)); sg.addColorStop(1, col(0))
    cx.fillStyle = sg; cx.fillRect(0, sy - H * 0.06, W, H * 0.08)
    cx.globalCompositeOperation = 'source-over'
  }
  const arrancar = () => { if (!raf) { resize(); raf = requestAnimationFrame(cuadro) } }
  const parar = () => { cancelAnimationFrame(raf); raf = 0 }
  const leer = () => {
    const c = orbe.classList, s = c.contains('escuchando') ? 'escuchando' : c.contains('pensando') ? 'pensando' : c.contains('hablando') ? 'hablando' : 'reposo'
    estado = s; activo = c.contains('on')
    if (activo) arrancar(); else setTimeout(() => { if (!orbe.classList.contains('on')) parar() }, 900)
  }
  new MutationObserver(leer).observe(orbe, { attributes: true, attributeFilter: ['class'] })
  window.__orbe = { get estado() { return estado } }
  leer()
})()
