'use strict';
// Holograma de Nova (envoltura): estado, volumen de voz, giro táctil y cambio de forma (esfera / giroscopio / torre).
(() => {
  const orbe = document.getElementById('orbe'); if (!orbe) return
  const cv = document.getElementById('fx'), holo = window.Holo.crear(cv)
  let esc = 0.94, estado = 'reposo', activo = false, raf = 0, t0 = performance.now()
  const P = { velAnillo: 0.2, energia: 0.15, tono: 200 }
  const META = {
    reposo:    { velAnillo: 0.15, energia: 0.12, tono: 200 },
    escuchando:{ velAnillo: 0.5,  energia: 0.45, tono: 203 },
    pensando:  { velAnillo: 2.4,  energia: 1,    tono: 192 },
    ejecutando:{ velAnillo: 1.6,  energia: 0.85, tono: 188 },
    hablando:  { velAnillo: 0.8,  energia: 0.7,  tono: 196 },
    error:     { velAnillo: 0.08, energia: 0.3,  tono: 2 },
  }
  let an = null, datos = null
  window.novaConectarAudio = (el) => {
    try {
      const AC = window.AudioContext || window.webkitAudioContext, ac = window.__novaAC || (window.__novaAC = new AC())
      const src = ac.createMediaElementSource(el); an = ac.createAnalyser(); an.fftSize = 256
      src.connect(an); an.connect(ac.destination); datos = new Uint8Array(an.frequencyBinCount)
      if (ac.state === 'suspended') ac.resume()
    } catch { an = null }
  }
  const nivel = (t) => {
    if (an) { an.getByteFrequencyData(datos); let s = 0; for (let i = 2; i < 40; i++) s += datos[i]; const v = s / 38 / 255; if (v > 0.02) return Math.min(1, v * 2.2) }
    return estado === 'hablando' ? 0.35 + 0.25 * Math.sin(t * 9) * Math.sin(t * 3.7) : 0
  }
  // resolución nativa: hasta 4096 px de lado (vectorial: se ve nítido también en pantallas 8K)
  const resize = () => {
    const r = orbe.getBoundingClientRect(), d = Math.max(1, Math.min(window.devicePixelRatio || 1, 3) * (window.__calidad || 1))
    const L = Math.max(2, Math.min(4096, Math.round(Math.max(r.width, r.height) * d)))
    if (cv.width !== L) { cv.width = L; cv.height = L }
  }
  let spin = 0, vel = 0, drag = false, ang0 = 0, mov = 0
  const angulo = (e) => { const r = orbe.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) }
  orbe.addEventListener('pointerdown', (e) => { drag = true; mov = 0; ang0 = angulo(e); vel = 0; orbe.classList.add('arrastra'); try { orbe.setPointerCapture(e.pointerId) } catch {} })
  orbe.addEventListener('pointermove', (e) => { if (!drag) return; const a = angulo(e); let d = a - ang0; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; ang0 = a; spin += d; vel = d * 60; mov += Math.abs(d) })
  const suelta = () => { if (!drag) return; drag = false; orbe.classList.remove('arrastra'); if (mov < 0.05) vel = 7 }
  orbe.addEventListener('pointerup', suelta); orbe.addEventListener('pointercancel', suelta)

  function cuadro(now) {
    raf = requestAnimationFrame(cuadro)
    const t = (now - t0) / 1000, dt = Math.min(0.05, (now - (cuadro.p || now)) / 1000); cuadro.p = now
    const m = META[estado] || META.reposo, k = 1 - Math.pow(0.001, dt)
    for (const q in m) P[q] += (m[q] - P[q]) * Math.min(1, k * 2.2)
    const lv = nivel(t), mic = Math.max(0, Math.min(1, window.__micNivel ?? 0))
    esc += (0.88 + 0.34 * Math.max(mic, lv * 0.9) - esc) * Math.min(1, dt * 7)   // voz fuerte = más grande, suave = más pequeño
    if (!drag) { spin += vel * dt; vel *= Math.pow(0.12, dt) }
    resize()
    holo.cuadro({ dt, t, E: P.energia, vel: P.velAnillo, lv, estado, spin, tono: P.tono, escala: esc })
  }
  const arrancar = () => { if (!raf) { resize(); raf = requestAnimationFrame(cuadro) } }
  const parar = () => { cancelAnimationFrame(raf); raf = 0 }
  const leer = () => {
    const c = orbe.classList, s = c.contains('escuchando') ? 'escuchando' : c.contains('pensando') ? 'pensando' : c.contains('hablando') ? 'hablando' : 'reposo'
    estado = s; activo = c.contains('on')
    if (activo) arrancar(); else setTimeout(() => { if (!orbe.classList.contains('on')) parar() }, 900)
  }
  new MutationObserver(leer).observe(orbe, { attributes: true, attributeFilter: ['class'] })
  // cambio de forma según el tema de la pregunta
  const MATE = /matem|ecuaci|integral|derivad|álgebra|algebra|cálcul|calcul|estadíst|estadist|probabilid|varianza|desviaci|regresi|correlaci|f[ií]sic|cu[aá]ntic|relatividad|newton|termodin[aá]m|electromagn|trigonom|geometr|teorema|demuestra|logaritm|matriz|vector|límite|limite|\d\s*[\^*/÷×]\s*\d|\bx\s*[\^=]|velocidad|aceleraci|part[ií]cula|gravedad|energ[ií]a cin|quantum/i
  const CONECTA = /conect|relacion|v[ií]ncul|causas|consecuencias|impacto|acontecimiento|noticias|actualidad|geopol|econom[ií]a|historia|contexto|compara|investiga|fuentes|qu[eé] est[aá] pasando|por qu[eé] pas|c[oó]mo se relaciona|tendencias|panorama|an[aá]lisis de/i
  const tema = (q) => MATE.test(q) ? 'giroscopio' : CONECTA.test(q) ? 'torre' : 'esfera'
  window.novaForma = (n) => holo.forma_(n)
  window.novaTema = (q) => { const f = tema(String(q || '')); holo.forma_(f); return f }
  window.__orbe = { get estado() { return estado }, get forma() { return holo.forma }, get transicion() { return holo.transicion } }
  leer()
})()
