/**
 * Búsqueda rápida de imágenes y videos. Cada fuente responde por separado y los resultados se
 * entregan en cuanto llegan (streaming), sin esperar a la más lenta.
 *  · Wikimedia Commons (imágenes y videos reproducibles, con licencia), Openverse (imágenes con licencia abierta)
 *  · YouTube Data API v3 (videos incrustables) si hay YOUTUBE_API_KEY
 * No descarga nada: solo guarda enlaces, miniaturas y metadatos. Cada resultado indica fuente y licencia.
 */
const COMMONS = () => process.env.COMMONS_BASE ?? 'https://commons.wikimedia.org'
const OPENVERSE = () => process.env.OPENVERSE_BASE ?? 'https://api.openverse.org'
const YOUTUBE = () => process.env.YOUTUBE_BASE ?? 'https://www.googleapis.com/youtube/v3'
const sinHtml = (s) => String(s ?? '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'").trim().slice(0, 160)
const seguro = (u) => { try { const x = new URL(u); return x.protocol === 'https:' || x.protocol === 'http:' ? x.href : '' } catch { return '' } }
async function j(url, signal) {
  const r = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(9000)].filter(Boolean)), headers: { 'user-agent': 'Nova/1.0 (asistente personal; contacto local)', accept: 'application/json' } })
  if (!r.ok) throw new Error(`${new URL(url).host} respondió ${r.status}`)
  return r.json()
}
async function commons(q, tipo, signal) {
  const ft = tipo === 'video' ? 'filetype:video' : 'filetype:bitmap'
  const d = await j(`${COMMONS()}/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=18&gsrsearch=${encodeURIComponent(q + ' ' + ft)}&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=520&iiextmetadatafilter=LicenseShortName|Artist&iiextmetadata=1&origin=*`, signal)
  return Object.values(d?.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0)).map((p) => {
    const i = p.imageinfo?.[0]; if (!i) return null
    const t = sinHtml(String(p.title ?? '').replace(/^Archivo:|^File:/, '').replace(/\.[a-z0-9]+$/i, '').replace(/_/g, ' '))
    const base = { titulo: t, thumb: seguro(i.thumburl || i.url), pagina: seguro(i.descriptionurl), fuente: 'Wikimedia Commons', licencia: sinHtml(i.extmetadata?.LicenseShortName?.value), autor: sinHtml(i.extmetadata?.Artist?.value) }
    return tipo === 'video' ? { ...base, tipo: 'video', src: seguro(i.url), mime: i.mime } : { ...base, tipo: 'imagen', url: seguro(i.url) }
  }).filter((x) => x && x.thumb)
}
async function openverse(q, signal) {
  const d = await j(`${OPENVERSE()}/v1/images/?q=${encodeURIComponent(q)}&page_size=18&mature=false`, signal)
  return (d?.results ?? []).map((r) => ({ tipo: 'imagen', titulo: sinHtml(r.title) || 'Imagen', thumb: seguro(r.thumbnail || r.url), url: seguro(r.url), pagina: seguro(r.foreign_landing_url), fuente: 'Openverse' + (r.source ? ' · ' + r.source : ''), licencia: [r.license, r.license_version].filter(Boolean).join(' ').toUpperCase(), autor: sinHtml(r.creator) })).filter((x) => x.thumb)
}
async function youtube(q, signal) {
  const d = await j(`${YOUTUBE()}/search?part=snippet&type=video&maxResults=12&safeSearch=moderate&videoEmbeddable=true&q=${encodeURIComponent(q)}&key=${encodeURIComponent(process.env.YOUTUBE_API_KEY)}`, signal)
  return (d?.items ?? []).filter((x) => x.id?.videoId).map((x) => ({ tipo: 'video', titulo: sinHtml(x.snippet?.title), thumb: seguro(x.snippet?.thumbnails?.medium?.url), embed: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(x.id.videoId)}`, pagina: `https://www.youtube.com/watch?v=${encodeURIComponent(x.id.videoId)}`, fuente: 'YouTube', autor: sinHtml(x.snippet?.channelTitle) })).filter((x) => x.thumb)
}
/** onItems(fuente, items) se llama apenas responde cada fuente. Devuelve el resumen final. */
export async function buscarMedios(tipo, q, onItems, signal) {
  q = String(q ?? '').replace(/\s+/g, ' ').trim().slice(0, 160)
  if (q.length < 2) throw new Error('Diga qué quiere ver.')
  const trabajos = tipo === 'video'
    ? [['Wikimedia Commons', () => commons(q, 'video', signal)], ...(process.env.YOUTUBE_API_KEY ? [['YouTube', () => youtube(q, signal)]] : [])]
    : [['Wikimedia Commons', () => commons(q, 'imagen', signal)], ['Openverse', () => openverse(q, signal)]]
  const fuentes = [], errores = []; let total = 0
  await Promise.all(trabajos.map(async ([n, f]) => {
    try { const it = await f(); if (it.length) { total += it.length; fuentes.push(n); onItems(n, it) } }
    catch (e) { errores.push(`${n}: ${e.message}`) }
  }))
  const enlace = tipo === 'video' && !process.env.YOUTUBE_API_KEY ? { tipo: 'enlace', titulo: 'Ver más videos en YouTube', pagina: `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`, fuente: 'YouTube', thumb: '' } : null
  if (enlace) onItems('YouTube', [enlace])
  return { q, tipo, total, fuentes, errores, estado: total ? 'ok' : errores.length === trabajos.length ? 'error' : 'sin_resultados' }
}
// ¿Pidió algo visual? Devuelve { tipo, q } o null.
const VERBO = /(busca(?:me)?|encuentra(?:me)?|mu[eé]stra(?:me)?|ens[eé][ñn]a(?:me)?|ver|quiero ver|dame|ponme|pon|trae(?:me)?|sac[ae](?:me)?)/i
export function intencionVisual(texto) {
  const t = String(texto ?? '').trim(); if (t.length > 200 || !VERBO.test(t)) return null
  const m = t.match(/\b(im[aá]gen(?:es)?|fotos?|fotograf[ií]as?|ilustraci[oó]n(?:es)?|v[ií]deos?|videos?|clips?)\b/i); if (!m) return null
  const tipo = /v[ií]deo|clip/i.test(m[1]) ? 'video' : 'imagen'
  let q = t.replace(/^(?:por favor[, ]*|nova[, ]*)/i, '').replace(VERBO, ' ').replace(/\b(una|unas|unos|un|las|los|la|el|me|de|del|sobre|acerca|referencias? visuales? (?:de|para)|que|explique[n]?|expliquen|muestre[n]?|im[aá]gen(?:es)?|fotos?|fotograf[ií]as?|ilustraci[oó]n(?:es)?|v[ií]deos?|videos?|clips?|diferentes|varios|algunos|algunas|tipos?|por favor)(?![\p{L}])/giu, ' ').replace(/[¿?¡!.,]/g, ' ').replace(/\s+/g, ' ').trim()
  if (q.length < 2) q = t.replace(m[0], '').replace(VERBO, '').trim()
  return q.length >= 2 ? { tipo, q } : null
}
