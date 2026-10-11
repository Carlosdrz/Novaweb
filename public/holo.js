'use strict';
// Motor del holograma de Nova: 100 % vectorial (independiente de la resolución, nítido en pantallas 4K/8K).
// Tres formas hechas con las mismas 10 curvas orbitales, que se transforman entre sí con una transición suave:
//   esfera (oficial) · giroscopio (matemáticas/estadística/física) · torre (conectar fuentes y acontecimientos)
(() => {
  const TRANS = 1.9, K = 10, M = 96, SIN = Math.sin, COS = Math.cos
  const rot = (p, ax, ay, az) => {
    let [a, b, d] = p, c = COS(ax), s = SIN(ax); [b, d] = [b * c - d * s, b * s + d * c]
    c = COS(ay); s = SIN(ay); [a, d] = [a * c + d * s, -a * s + d * c]
    c = COS(az); s = SIN(az); [a, b] = [a * c - b * s, a * s + b * c]; return [a, b, d]
  }
  const FORMAS = {
    esfera(i, th, t) {
      if (i === 9) return [COS(th), SIN(th), 0]
      const R = 0.93 - (i % 3) * 0.09
      return rot([R * COS(th), R * SIN(th), 0], 1.2 * i + t * 0.18, i * 0.7 + t * 0.12 * (i % 2 ? 1 : -1), i * 0.9)
    },
    giroscopio(i, th, t) {
      if (i < 5) { const R = 1 - i * 0.125; return rot([R * COS(th), R * SIN(th), 0], t * (0.3 + 0.1 * i) * (i % 2 ? -1 : 1) + i, t * (0.2 + 0.07 * i) + i * 1.3, 0) }
      if (i < 9) return rot([COS(th), SIN(th), 0], Math.PI / 2, t * 0.35 + (i - 5) * Math.PI / 4, 0)
      return [0.14 * COS(th), 0.14 * SIN(th) * 0.0 + 0.14 * SIN(th), 0.14 * SIN(th * 2)]
    },
    torre(i, th, t) {
      if (i === 9) return [0.035 * SIN(th * 3 + t), -0.98 * COS(th), 0.035 * COS(th * 3 + t)]
      const k = i / 8, r = 0.2 + 0.74 * Math.pow(k, 1.5), y = -0.9 + 1.8 * k
      return rot(rot([r * COS(th), y, r * SIN(th)], 0, t * (0.35 + 0.05 * i) * (i % 2 ? -1 : 1), 0), 0.42, 0, 0)
    },
  }
  const NOMBRES = Object.keys(FORMAS)
  const ease = (w) => w * w * (3 - 2 * w)

  function crear(cv) {
    const cx = cv.getContext('2d'), w = { esfera: 1, giroscopio: 0, torre: 0 }
    let meta = 'esfera', T = 0, fase = 0, W = 0, flash = 0
    const ondas = []; let ultOnda = 0
    const punto = (i, th, t) => {
      let sw = 0, x = 0, y = 0, z = 0
      for (const n of NOMBRES) { if (w[n] <= 0.0005) continue; const s = ease(w[n]), p = FORMAS[n](i, th, t); sw += s; x += p[0] * s; y += p[1] * s; z += p[2] * s }
      return sw ? [x / sw, y / sw, z / sw] : [0, 0, 0]
    }
    const api = {
      get forma() { return meta }, get transicion() { return 1 - Math.max(...Object.values(w)) },
      forma_(n) { if (FORMAS[n] && n !== meta) { meta = n; flash = 1 } },
      cuadro(o) {
        const { dt, t, E, vel, lv, estado, spin, tono, escala } = o
        const d = cv.width; if (W !== d) W = d
        const R = d / 2, c = R, u = d / 900
        for (const n of NOMBRES) { const dir = n === meta ? 1 : -1; w[n] = Math.max(0, Math.min(1, w[n] + dir * dt / TRANS)) }
        T += dt * (0.55 + 0.45 * vel); fase += dt * (1 + E * 3); flash = Math.max(0, flash - dt / TRANS)
        const tr = 4 * flash * (1 - flash) // intensidad máxima a mitad de la transición
        const col = (a, l = 62, h = tono) => `hsla(${h},100%,${l}%,${a})`
        cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, d, d); cx.globalCompositeOperation = 'lighter'
        const ay = T * 0.07 + spin * 0.5, az = spin, S = R * 0.9 * escala
        const proy = (p) => { const q = rot(p, 0, ay, az), f = 1 / (1 + q[2] * 0.3); return [c + q[0] * S * f, c + q[1] * S * f, f, q[2]] }
        // núcleo (se estira en torre)
        const el = ease(w.torre), cr = R * (0.3 + 0.1 * E + 0.12 * lv + 0.1 * tr)
        cx.save(); cx.translate(c, c); cx.scale(1, 1 + el * 2.2); const g = cx.createRadialGradient(0, 0, 0, 0, 0, cr)
        g.addColorStop(0, col(0.6 + 0.35 * E + 0.3 * lv, 88)); g.addColorStop(0.4, col(0.2 + 0.2 * E, 60)); g.addColorStop(1, col(0)); cx.fillStyle = g; cx.fillRect(-R, -R * 2, d, d * 2); cx.restore()
        // anillo exterior de grados
        cx.save(); cx.translate(c, c); cx.rotate(-T * 0.12); cx.strokeStyle = col(0.45 + 0.3 * E, 70); cx.lineWidth = 1.2 * u
        for (let i = 0; i < 120; i++) { const a = i / 120 * 6.283, l = i % 10 === 0 ? 0.035 : 0.014; cx.beginPath(); cx.moveTo(COS(a) * R * 0.985, SIN(a) * R * 0.985); cx.lineTo(COS(a) * R * (0.985 - l), SIN(a) * R * (0.985 - l)); cx.stroke() } cx.restore()
        // curvas orbitales
        for (let i = 0; i < K; i++) {
          cx.beginPath()
          for (let j = 0; j <= M; j++) { const q = proy(punto(i, j / M * 6.2832, T)); j ? cx.lineTo(q[0], q[1]) : cx.moveTo(q[0], q[1]) }
          cx.strokeStyle = col(Math.min(1, (0.38 + 0.3 * E) * (1 + tr * 0.8)), 62 + 10 * tr, tono + (i % 3) * 5); cx.lineWidth = (1.3 + 0.6 * E + 1.4 * tr) * u
          cx.shadowColor = col(0.9); cx.shadowBlur = (6 + 14 * tr) * u; cx.stroke(); cx.shadowBlur = 0
          // satélites con estela
          const veloc = (0.9 + 0.15 * i) * (i % 2 ? 1 : -1) * (0.7 + 0.8 * vel), base = fase * 0.6 * veloc + i * 2, nSat = i === 9 ? 1 : 2
          for (let s = 0; s < nSat; s++) {
            const th0 = base + s * 3.1, tail = 14
            for (let k = tail; k >= 0; k--) {
              const q = proy(punto(i, th0 - k * 0.05 * Math.sign(veloc), T)), a = (1 - k / tail) * 0.55 * (0.5 + q[2] / 2)
              cx.fillStyle = col(a, 75); cx.beginPath(); cx.arc(q[0], q[1], (3.2 + (i % 3) * 0.7 - (s ? 0.8 : 0)) * u * (1 - k / tail * 0.6) * q[2] * (1 + E * 0.5), 0, 6.283); cx.fill()
            }
            const q = proy(punto(i, th0, T)); cx.shadowBlur = 16 * u; cx.shadowColor = col(1); cx.fillStyle = col(1, 92)
            cx.beginPath(); cx.arc(q[0], q[1], (3.8 + (i % 3) * 0.7) * u * q[2] * (1 + 0.4 * tr), 0, 6.283); cx.fill(); cx.shadowBlur = 0
          }
        }
        // rayo vertical y destellos extra durante la transición / en la torre
        if (el > 0.02 || tr > 0.02) {
          const bw = (el * 0.9 + tr * 0.5) , gg = cx.createLinearGradient(0, 0, 0, d)
          gg.addColorStop(0, col(0)); gg.addColorStop(0.5, col(0.55 * bw, 85)); gg.addColorStop(1, col(0))
          cx.fillStyle = gg; cx.fillRect(c - (2 + 5 * tr) * u, 0, (4 + 10 * tr) * u, d)
        }
        // onda de choque al cambiar de forma
        if (flash > 0) { const p = 1 - flash; cx.strokeStyle = col(0.7 * (1 - p), 80); cx.lineWidth = 3 * u; cx.beginPath(); cx.arc(c, c, R * (0.1 + 0.95 * p), 0, 6.283); cx.stroke() }
        // arcos neuronales al pensar
        if (estado === 'pensando') {
          cx.lineWidth = 1.2 * u
          for (let i = 0; i < 9; i++) {
            const a1 = fase * 0.9 + i * 0.7, a2 = a1 + 1.4 + SIN(T * 2 + i), r1 = R * (0.3 + 0.35 * ((i * 37) % 10) / 10)
            cx.strokeStyle = col(0.18 + 0.25 * Math.abs(SIN(T * 3 + i)), 75); cx.beginPath(); cx.moveTo(c + COS(a1) * r1, c + SIN(a1) * r1); cx.quadraticCurveTo(c, c, c + COS(a2) * r1 * 1.25, c + SIN(a2) * r1 * 1.25); cx.stroke()
          }
        }
        // ondas al hablar / escuchar
        if ((estado === 'hablando' || estado === 'escuchando') && t - ultOnda > (estado === 'hablando' ? 0.55 - lv * 0.3 : 0.9)) { ultOnda = t; ondas.push({ t, a: estado === 'hablando' ? 0.5 + lv * 0.4 : 0.35, in: estado === 'escuchando' }) }
        for (let i = ondas.length - 1; i >= 0; i--) {
          const q = ondas[i], p = (t - q.t) / 1.8; if (p >= 1) { ondas.splice(i, 1); continue }
          cx.lineWidth = 2 * u; cx.strokeStyle = col(q.a * (1 - p), 70); cx.beginPath(); cx.arc(c, c, R * (0.15 + 0.8 * (q.in ? 1 - p : p)), 0, 6.283); cx.stroke()
        }
        cx.globalCompositeOperation = 'source-over'
      },
    }
    return api
  }
  window.Holo = { crear, TRANS, NOMBRES }
})()
