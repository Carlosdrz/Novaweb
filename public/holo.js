'use strict';
// Holograma de Nova en 3D (tiempo real, Canvas 2D vectorial, sin imágenes): resolución nativa hasta 4096 px,
// y se adapta solo al dispositivo (baja partículas y resolución si no llega a ~50 fps; las sube si sobra).
// Tres formas con transición luminosa de 3,2 s:  esfera = sistema orbital (oficial) · giroscopio = poliedro (cálculo,
// estadística, física, informática) · torre = torre de luz (conectar ideas, fuentes y acontecimientos).
(() => {
  const TRANS = 3.2, M = 48, S = Math.sin, C = Math.cos, TAU = 6.283185307, PHI = (1 + Math.sqrt(5)) / 2
  const NOM = { esfera: 'A', giroscopio: 'B', torre: 'C' }, INV = { A: 'esfera', B: 'giroscopio', C: 'torre' }
  const ease = (x) => x * x * x * (x * (6 * x - 15) + 10), clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x))
  const rotm = (ax, ay, az) => {
    const cx = C(ax), sx = S(ax), cy = C(ay), sy = S(ay), cz = C(az), sz = S(az)
    // Z·Y·X
    const yx = [cy, sy * sx, sy * cx, 0, cx, -sx, -sy, cy * sx, cy * cx]
    return [cz * yx[0] - sz * yx[3], cz * yx[1] - sz * yx[4], cz * yx[2] - sz * yx[5], sz * yx[0] + cz * yx[3], sz * yx[1] + cz * yx[4], sz * yx[2] + cz * yx[5], yx[6], yx[7], yx[8]]
  }
  const mm = (a, b) => { const r = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r.push(a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]); return r }
  const ap = (m, p) => [m[0] * p[0] + m[1] * p[1] + m[2] * p[2], m[3] * p[0] + m[4] * p[1] + m[5] * p[2], m[6] * p[0] + m[7] * p[1] + m[8] * p[2]]
  const ell = (a, b, R, th) => { const o = []; for (let i = 0; i < M; i++) { const q = th ? th[i] : i / (M - 1) * TAU; o.push(ap(R, [a * C(q), b * S(q), 0])) } return o }
  const L = (p, w, b, st) => ({ p, w, b, st: !!st })
  // ---- poliedros
  const IV = [[0, 1, PHI], [0, -1, PHI], [0, 1, -PHI], [0, -1, -PHI], [1, PHI, 0], [-1, PHI, 0], [1, -PHI, 0], [-1, -PHI, 0], [PHI, 0, 1], [-PHI, 0, 1], [PHI, 0, -1], [-PHI, 0, -1]].map((v) => { const n = Math.hypot(...v); return v.map((x) => x / n) })
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
  const IE = []; for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) if (Math.abs(dist(IV[i], IV[j]) - 1.0515) < 0.02) IE.push([i, j])
  const OV = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]], OE = []
  for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) if (Math.abs(dist(OV[i], OV[j]) - 1.4142) < 0.02) OE.push([i, j])
  const sc = (v, k) => [v[0] * k, v[1] * k, v[2] * k]
  // ---- geometrías → { lineas, sats:[{tr, size}], nodos:[{p,size}], core }
  function geoA(t) {
    const li = [], sats = [], rat = [0.62, 0.8, 0.56, 0.86, 0.7, 0.6], sp = [0.9, -0.7, 0.55, -0.42, 0.33, -0.27]
    for (let i = 0; i < 6; i++) {
      const a = 0.42 + 0.11 * i, b = a * rat[i], R = rotm(0.5 + 1.05 * i + 0.09 * t * (i % 2 ? 1 : -1), 0.8 * i + 0.07 * t * (i % 2 ? -1 : 1), 0.6 * i)
      li.push(L(ell(a, b, R), i === 1 || i === 4 ? 3 : 2, i === 1 || i === 4 ? 0.85 : 0.55))
      const phs = i < 4 ? [0, 3.4] : [1]
      phs.forEach((ph, k) => { const th = []; for (let j = 0; j < 20; j++) th.push(sp[i] * t * 0.8 + ph + i - j * 0.045 * Math.sign(sp[i])); const tr = th.map((q) => ap(R, [a * C(q), b * S(q), 0])); sats.push({ tr, size: k ? 5.5 : 8 }) })
    }
    const R = rotm(0.4 * t, 0.3 * t, 0.1 * t), r0 = 0.13
    for (const la of [-0.8, -0.4, 0, 0.4, 0.8]) { const r = r0 * Math.sqrt(1 - la * la), pts = []; for (let i = 0; i < 32; i++) { const q = i / 31 * TAU; pts.push(ap(R, [r * C(q), r0 * la, r * S(q)])) } li.push(L(pts, 1.3, 0.6)) }
    for (let k = 0; k < 4; k++) { const Rk = rotm(0, k * Math.PI / 4, 0), pts = []; for (let i = 0; i < 32; i++) { const q = i / 31 * TAU; pts.push(ap(R, ap(Rk, [r0 * C(q), r0 * S(q), 0]))) } li.push(L(pts, 1.3, 0.6)) }
    return { li, sats, nodos: [], core: 1 }
  }
  function geoB(t) {
    const li = [], sats = [], nodos = [], Ri = rotm(0.3 * t, 0.45 * t, 0.1 * t), Ro = rotm(-0.2 * t, 0.25 * t, 0.05 * t), Rq = rotm(-0.5 * t, 0.7 * t, 0)
    const pi_ = IV.map((v) => ap(Ri, sc(v, 0.27))), po = IV.map((v) => ap(Ro, sc(v, 0.47 * (1 + 0.03 * S(t * 1.3))))), pq = OV.map((v) => ap(Rq, sc(v, 0.15)))
    for (const [i, j] of IE) li.push(L([pi_[i], pi_[j]], 3.4, 1, 1))
    for (const [i, j] of IE) li.push(L([po[i], po[j]], 1.3, 0.32, 1))
    for (let i = 0; i < 12; i++) {
      li.push(L([pi_[i], po[i]], 1.4, 0.55, 1))
      let k = 0, best = 1e9; for (let j = 0; j < 12; j++) { const d = dist(po[j], pi_[i]) + (j === i ? 9 : 0); if (d < best) { best = d; k = j } }
      li.push(L([pi_[i], po[k]], 1.1, 0.3, 1))
    }
    for (const [i, j] of OE) li.push(L([pq[i], pq[j]], 2.2, 0.85, 1))
    const cfg = [[0.98, 0.55, 3.4, 0.95, [0.3, 0.2, 0.4], 0.8, [0, 3]], [0.84, 0.7, 2.2, 0.6, [1.9, 0.6, 0.2], -0.6, [1.5]], [0.66, 0.5, 1.8, 0.5, [0.9, 1.7, 1.1], 0.9, [0.5, 3.6]]]
    cfg.forEach(([a, r, w, b, ang, spd, phs], k) => {
      const R = rotm(ang[0] + 0.06 * t, ang[1] + 0.05 * t * (k % 2 ? 1 : -1), ang[2]); li.push(L(ell(a, a * r, R), w, b))
      for (const ph of phs) { const th = []; for (let j = 0; j < 24; j++) th.push(spd * t + ph - j * 0.05 * Math.sign(spd)); sats.push({ tr: th.map((q) => ap(R, [a * C(q), a * r * S(q), 0])), size: 9 }) }
    })
    for (const v of pi_) nodos.push({ p: v, size: 5 }); for (const v of po) nodos.push({ p: v, size: 3.5 })
    return { li, sats, nodos, core: 0.6 }
  }
  const RAYS = Array.from({ length: 7 }, (_, q) => { const a = (q * 0.9 + 0.7) % TAU, rr = 0.85 + ((q * 37) % 10) / 10 * 0.35; return { x: rr * C(a), z: rr * S(a), top: -0.7 - ((q * 53) % 10) / 10 * 0.8 } })
  function geoC(t) {
    const li = [], nodos = [], rings = [], n = 8
    for (let k = 0; k < 13; k++) {
      const f = k / 12, y = -0.9 + 1.62 * f, r = 0.08 + 0.66 * Math.pow(f, 1.3), a = t * 0.16 * (k % 2 ? 1 : -1) + k * 0.31, v = []
      for (let i = 0; i < n; i++) v.push([r * C(a + i * TAU / n), y, r * S(a + i * TAU / n)])
      rings.push(v); const l = L([...v, v[0]], k % 3 === 0 ? 2.8 : 1.8, 0.95 - 0.25 * (1 - f)); l.fill = k; li.push(l)
      for (const p of v) nodos.push({ p, size: k % 3 === 0 ? 4 : 2.6 })
    }
    for (let k = 0; k < 12; k++) for (let v = 0; v < n; v++) { li.push(L([rings[k][v], rings[k + 1][v]], 1.1, 0.4, 1)); li.push(L([rings[k][v], rings[k + 1][(v + 1) % n]], 1, 0.28, 1)) }
    li.push(L([[0, -1.08, 0], [0, 0.86, 0]], 4.5, 1, 1))
    for (let q = 0; q < 5; q++) nodos.push({ p: [0, 0.86 - ((t * 0.32 + q / 5) % 1) * 1.94, 0], size: 8 })
    nodos.push({ p: [0, -1.08, 0], size: 13 })
    for (const rr of [0.25, 0.42, 0.58, 0.74, 0.88, 1.02]) { const pts = []; for (let i = 0; i < 40; i++) { const q = i / 39 * TAU; pts.push([rr * C(q), 0.86, rr * S(q)]) } li.push(L(pts, 1.4, 0.5)) }
    for (let s = 0; s < 24; s++) { const a = s * TAU / 24 + t * 0.03; li.push(L([[0.22 * C(a), 0.86, 0.22 * S(a)], [1.02 * C(a), 0.86, 1.02 * S(a)]], 1, 0.22, 1)) }
    RAYS.forEach((r, q) => { li.push(L([[r.x, 0.86, r.z], [r.x, r.top, r.z]], 1.6, 0.55, 1)); nodos.push({ p: [r.x, 0.86 - ((t * (0.25 + 0.05 * q) + q * 0.17) % 1) * (0.86 - r.top), r.z], size: 5 }) })
    return { li, sats: [], nodos, core: 0.6 }
  }
  const GEO = { A: geoA, B: geoB, C: geoC }
  const lenPt = (l, s) => { const n = l.p.length - 1, x = clamp(s, 0, 0.99999) * n, i = Math.floor(x), f = x - i, a = l.p[i], b = l.p[i + 1]; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f] }
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647

  function crear(cv) {
    const cx = cv.getContext('2d'), sm = document.createElement('canvas'), sx = sm.getContext('2d'), sm2 = document.createElement('canvas'), sx2 = sm2.getContext('2d')
    const MAXP = 12000, asign = {}
    for (const f of 'ABC') {
      const g = GEO[f](0).li, wt = g.map((l) => l.b * Math.sqrt(l.w) * (l.st ? 0.4 : 1)), tot = wt.reduce((a, b) => a + b, 0), cum = []; let ac = 0; for (const w of wt) { ac += w / tot; cum.push(ac) }
      asign[f] = { k: Array.from({ length: MAXP }, () => { const r = rnd(); let i = cum.findIndex((c) => r <= c); return i < 0 ? cum.length - 1 : i }), s: Array.from({ length: MAXP }, rnd) }
    }
    const PSP = Array.from({ length: MAXP }, () => (0.01 + rnd() * 0.05) * (rnd() < 0.5 ? -1 : 1)), PD = Array.from({ length: MAXP }, rnd), PB = Array.from({ length: MAXP }, () => 0.35 + 0.65 * Math.pow(rnd(), 2))
    const PDIR = Array.from({ length: MAXP }, () => { const v = [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5], n = Math.hypot(...v) || 1; return v.map((x) => x / n) })
    const DUST = Array.from({ length: 1700 }, () => [(rnd() - 0.5) * 4.4, (rnd() - 0.5) * 4.4, (rnd() - 0.5) * 4.4]), DV = DUST.map(() => [(rnd() - 0.5) * 0.04, (rnd() - 0.5) * 0.04, (rnd() - 0.5) * 0.04])
    let cur = 'A', to = 'A', u = 0, pend = null, T = 0, fase = 0, nPart = 6500, ms = 16, acc = 0, nAcc = 0, W = 0
    const ondas = []; let ultOnda = 0
    const api = {
      get forma() { return INV[u > 0.5 ? to : cur] }, get transicion() { return cur === to ? 0 : u },
      forma_(n) {
        const f = NOM[n]; if (!f) return
        if (cur === to) { if (f !== cur) { to = f; u = 0 } } else if (f !== to) pend = f
      },
      cuadro(o) {
        const { dt, t, E, vel, lv, estado, spin, tono, escala } = o
        const d = cv.width, R = d / 2, c = R, uu = d / 2160, hue = tono
        // transición
        if (cur !== to) { u += dt / TRANS; if (u >= 1) { cur = to; u = 0; if (pend) { if (pend !== cur) to = pend; pend = null } } }
        const f = cur, g = to, morph = f !== g, mu = morph ? ease(clamp(u)) : 0
        T += dt * (0.55 + 0.45 * vel); fase += dt
        // rendimiento adaptativo
        acc += dt; nAcc++; if (acc > 1.2) { ms = acc / nAcc; acc = 0; nAcc = 0; const q = window.__calidad || 1
          if (ms > 1 / 44) { nPart = Math.max(700, nPart * 0.8); window.__calidad = Math.max(0.45, q * 0.88) } else if (ms < 1 / 57 && nPart < MAXP) { nPart = Math.min(MAXP, nPart * 1.1); window.__calidad = Math.min(1, q * 1.04) } }
        const np = Math.floor(nPart)
        const camP = 0.30 + 0.07 * S(T * 0.11), camY = 0.55 * S(T * 0.17) + 0.07 * T + spin * 0.4
        const V = mm(rotm(0, 0, spin * 0.6), mm(rotm(camP, 0, 0), rotm(0, camY, 0)))
        const Sc = 0.8 * R * Math.min(escala, 1.04), D = 3.4
        const pr = (p) => { const q = ap(V, p), k = D / (D - q[2]); return [c + Sc * q[0] * k, c + Sc * q[1] * k, q[2]] }
        cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, d, d); cx.globalCompositeOperation = 'lighter'; cx.lineCap = 'round'; cx.lineJoin = 'round'
        const col = (a, l = 62) => `hsla(${hue},100%,${l}%,${Math.max(0, Math.min(1, a))})`
        // polvo en profundidad
        cx.fillStyle = col(0.35, 75); cx.beginPath()
        for (let i = 0; i < DUST.length; i += 1) { const p = DUST[i], v = DV[i], q = [((p[0] + v[0] * T + 2.2) % 4.4 + 4.4) % 4.4 - 2.2, ((p[1] + v[1] * T + 2.2) % 4.4 + 4.4) % 4.4 - 2.2, ((p[2] + v[2] * T + 2.2) % 4.4 + 4.4) % 4.4 - 2.2], s = pr(q); cx.rect(s[0], s[1], 1.6 * uu * 1.5, 1.6 * uu * 1.5) }
        cx.fill()
        // anillo de grados
        const Rr = Math.min(Sc * 1.18, R * 0.97), ang = -T * 0.06
        for (const [mod, l, a, w] of [[15, 0.045, 0.5, 2], [5, 0.022, 0.3, 1.4], [1, 0.011, 0.22, 1]]) {
          cx.beginPath(); for (let i = 0; i < 180; i++) { if ((mod === 5 && (i % 15 === 0 || i % 5)) || (mod === 1 && i % 5 === 0) || (mod === 15 && i % 15)) continue; const q = ang + i * TAU / 180; cx.moveTo(c + C(q) * Rr, c + S(q) * Rr * 0.97); cx.lineTo(c + C(q) * Rr * (1 - l), c + S(q) * Rr * 0.97 * (1 - l)) }
          cx.strokeStyle = col(a + 0.15 * E); cx.lineWidth = w * 1.3 * uu; cx.stroke()
        }
        cx.beginPath(); cx.ellipse(c, c, Rr, Rr * 0.97, 0, 0, TAU); cx.strokeStyle = col(0.2); cx.lineWidth = 1.3 * uu; cx.stroke()
        const geos = { [f]: GEO[f](T) }; if (morph) geos[g] = GEO[g](T)
        const aA = morph ? clamp(1 - mu / 0.45) : 1, aB = morph ? clamp((mu - 0.55) / 0.45) : 0
        const dibujar = (fm, al) => {
          if (al <= 0.01) return; const G = geos[fm], boost = 1 + 0.5 * E
          for (const l of G.li) {
            const P = l.p.map(pr)
            if (l.fill !== undefined) { cx.beginPath(); P.forEach((q, i) => i ? cx.lineTo(q[0], q[1]) : cx.moveTo(q[0], q[1])); cx.fillStyle = col(0.1 * al * (0.5 + l.fill / 24)); cx.fill() }
            const lw = Math.max(1, l.w * 1.3 * uu * (0.9 + 0.3 * E))
            if (l.st) { const z = (P[0][2] + P[P.length - 1][2]) / 2, dp = clamp(0.72 + 0.34 * z, 0.35, 1.15); cx.beginPath(); cx.moveTo(P[0][0], P[0][1]); cx.lineTo(P[P.length - 1][0], P[P.length - 1][1]); cx.strokeStyle = col(l.b * al * dp * boost, 62 + (l.w > 2.5 ? 12 : 0)); cx.lineWidth = lw; cx.stroke(); continue }
            const ch = 4, step = Math.ceil((P.length - 1) / ch)
            for (let a = 0; a < P.length - 1; a += step) {
              const e = Math.min(a + step, P.length - 1); let z = 0; for (let i = a; i <= e; i++) z += P[i][2]; z /= e - a + 1; const dp = clamp(0.72 + 0.34 * z, 0.35, 1.15)
              cx.beginPath(); for (let i = a; i <= e; i++) i === a ? cx.moveTo(P[i][0], P[i][1]) : cx.lineTo(P[i][0], P[i][1]); cx.strokeStyle = col(l.b * al * dp * boost, 62 + (l.w > 2.5 ? 12 : 0)); cx.lineWidth = lw; cx.stroke()
            }
          }
          for (const s of G.sats) {
            const P = s.tr.map(pr), n = P.length
            for (let i = n - 1; i > 0; i--) { const a = Math.pow(1 - i / n, 1.5) * al; cx.fillStyle = col(a * 0.7, 72); cx.beginPath(); cx.arc(P[i][0], P[i][1], s.size * 1.2 * uu * (1 - i / n * 0.65) * 1.3, 0, TAU); cx.fill() }
            cx.fillStyle = col(al, 92); cx.beginPath(); cx.arc(P[0][0], P[0][1], s.size * 1.5 * uu * 1.3, 0, TAU); cx.fill()
          }
          for (const nd of G.nodos) { const p = pr(nd.p); cx.fillStyle = col(al * 0.9, 85); cx.beginPath(); cx.arc(p[0], p[1], nd.size * 1.3 * uu * (0.8 + 0.3 * p[2]), 0, TAU); cx.fill() }
        }
        dibujar(f, aA); if (morph) dibujar(g, aB)
        // partículas de energía (con remolino y destello en la transición)
        const pf = (i) => lenPt(geos[f].li[asign[f].k[i]], (asign[f].s[i] + PSP[i] * T % 1 + 1) % 1)
        const bk = [[], [], []]
        for (let i = 0; i < np; i++) {
          let p = pf(i), lum
          if (morph) {
            const pg = lenPt(geos[g].li[asign[g].k[i]], (asign[g].s[i] + PSP[i] * T % 1 + 1) % 1), uj = clamp(mu * 1.5 - PD[i] * 0.5), ej = uj * uj * (3 - 2 * uj), mid = S(Math.PI * uj), sw = mid * 1.3, cs = C(sw), sn = S(sw)
            const x = p[0] * (1 - ej) + pg[0] * ej + PDIR[i][0] * mid * 0.32, y = p[1] * (1 - ej) + pg[1] * ej + PDIR[i][1] * mid * 0.32, z = p[2] * (1 - ej) + pg[2] * ej + PDIR[i][2] * mid * 0.32
            p = [x * cs - z * sn, y, x * sn + z * cs]; lum = PB[i] * (0.55 + 1.3 * mid)
          } else lum = PB[i] * (0.55 + 0.45 * S(T * 3 + PD[i] * 40) + 0.3 * E)
          const s = pr(p); bk[lum < 0.45 ? 0 : lum < 0.85 ? 1 : 2].push(s[0], s[1])
        }
        const ps = Math.max(1.4, 2.2 * uu * 1.2)
        for (let b = 0; b < 3; b++) { cx.fillStyle = col([0.35, 0.65, 0.95][b], [60, 70, 85][b]); cx.beginPath(); const a = bk[b]; for (let i = 0; i < a.length; i += 2) cx.rect(a[i], a[i + 1], ps, ps); cx.fill() }
        // núcleo luminoso (el torre usa solo un destello pequeño)
        const cw = (geos[f].core ?? 0) * aA + (morph ? (geos[g].core ?? 0) * aB : 0), pc = pr([0, 0, 0])
        if (cw > 0.02) for (const [r, a, l] of [[140, 0.22, 55], [70, 0.4, 62], [34, 0.8, 78], [14, 1, 92]]) { const gr = cx.createRadialGradient(pc[0], pc[1], 0, pc[0], pc[1], r * uu * (1 + 0.06 * S(T * 3) + 0.1 * lv + 0.08 * E)); gr.addColorStop(0, col(a * cw, l)); gr.addColorStop(1, col(0, l)); cx.fillStyle = gr; cx.beginPath(); cx.arc(pc[0], pc[1], r * uu * 1.3, 0, TAU); cx.fill() }
        // ondas de choque luminosas al cambiar de forma
        let gain = 1
        if (morph) { gain = 1 + 0.9 * S(Math.PI * mu); for (const off of [0, 0.12]) { const p = clamp(mu - off), a = S(Math.PI * p); if (a > 0.01) { cx.beginPath(); cx.ellipse(c, c, Sc * (0.1 + 1.15 * p), Sc * (0.1 + 1.15 * p) * 0.45, 0, 0, TAU); cx.strokeStyle = col(0.8 * a, 80); cx.lineWidth = Math.max(2, 5 * a) * uu * 1.3; cx.stroke() } } }
        // ondas al hablar / escuchar
        if ((estado === 'hablando' || estado === 'escuchando') && t - ultOnda > (estado === 'hablando' ? 0.55 - lv * 0.3 : 0.9)) { ultOnda = t; ondas.push({ t, a: estado === 'hablando' ? 0.5 + lv * 0.4 : 0.35, in: estado === 'escuchando' }) }
        for (let i = ondas.length - 1; i >= 0; i--) { const q = ondas[i], p = (t - q.t) / 1.8; if (p >= 1) { ondas.splice(i, 1); continue } cx.beginPath(); cx.arc(c, c, Sc * (0.15 + 0.8 * (q.in ? 1 - p : p)), 0, TAU); cx.strokeStyle = col(q.a * (1 - p), 70); cx.lineWidth = 2 * uu * 1.3; cx.stroke() }
        // brillo cinematográfico (bloom en dos niveles, sin filtros: portátil y rápido)
        const w1 = Math.max(64, d >> 2), w2 = Math.max(32, d >> 4); if (sm.width !== w1) { sm.width = sm.height = w1 } if (sm2.width !== w2) { sm2.width = sm2.height = w2 }
        sx.globalCompositeOperation = 'copy'; sx.drawImage(cv, 0, 0, w1, w1); sx2.globalCompositeOperation = 'copy'; sx2.drawImage(sm, 0, 0, w2, w2)
        cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high'
        cx.globalAlpha = Math.min(1, 0.85 * gain); cx.drawImage(sm, 0, 0, d, d); cx.globalAlpha = Math.min(1, 1.1 * gain); cx.drawImage(sm2, 0, 0, d, d); cx.globalAlpha = 1
        cx.globalCompositeOperation = 'source-over'
      },
    }
    return api
  }
  window.Holo = { crear, TRANS, NOMBRES: ['esfera', 'giroscopio', 'torre'] }
})()
