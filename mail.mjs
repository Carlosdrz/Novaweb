/**
 * Avisos de Gmail.
 *
 * Se conecta a Gmail por IMAP y se queda en IDLE: el servidor avisa en el acto
 * cuando llega un correo, sin sondeos. Solo se anuncian los correos cuyo
 * remitente está en la lista; el resto se ignora. El contenido nunca se envía al
 * modelo — solo remitente y asunto, que el navegador lee en voz alta.
 *
 * Configuración (en ./.env o en el entorno):
 *   GMAIL_USER             cuenta de Gmail que se vigila
 *   GMAIL_APP_PASSWORD     contraseña de aplicación de 16 caracteres (NO tu clave normal)
 *   GMAIL_WATCH_SENDERS    remitentes a avisar, separados por comas (opcional)
 */
import { ImapFlow } from 'imapflow'

const DEFAULT_SENDERS = [
  'carlosdrz09@colegiopadreemilianotardif.edu.do',
  'carlossdavid0307@gmail.com',
]

export function startMailWatcher({ onMail }) {
  const user = (process.env.GMAIL_USER ?? '').trim()
  const pass = (process.env.GMAIL_APP_PASSWORD ?? '').replace(/\s+/g, '')
  if (!user || !pass) {
    console.log('[nova] avisos de Gmail desactivados: faltan GMAIL_USER y GMAIL_APP_PASSWORD')
    return () => {}
  }
  const senders = new Set(
    (process.env.GMAIL_WATCH_SENDERS ?? DEFAULT_SENDERS.join(','))
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  )

  let stopped = false
  let client = null
  let lastUid = 0
  let retry = 0
  let work = Promise.resolve()

  async function check() {
    const found = []
    for await (const m of client.fetch(
      `${lastUid + 1}:*`,
      { uid: true, envelope: true },
      { uid: true },
    )) {
      // IMAP siempre devuelve al menos el último mensaje del rango, aunque ya lo
      // hayamos visto; el filtro por uid evita anunciarlo dos veces.
      if (m.uid <= lastUid) continue
      found.push(m)
    }
    for (const m of found) {
      lastUid = Math.max(lastUid, m.uid)
      const from = m.envelope?.from?.[0]
      const address = (from?.address ?? '').toLowerCase()
      if (!senders.has(address)) continue
      onMail({
        from: (from?.name || address.split('@')[0]).trim(),
        address,
        subject: String(m.envelope?.subject ?? '').trim().slice(0, 140),
      })
    }
  }

  async function connect() {
    if (stopped) return
    client = new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: { user, pass },
      logger: false,
    })
    // Sin este oyente un error de red tumbaría todo el bridge.
    client.on('error', (err) => console.warn('[nova] gmail:', err.message))
    client.on('close', () => {
      if (stopped) return
      const wait = Math.min(60000, 2000 * 2 ** retry++)
      console.warn(`[nova] gmail desconectado; reintentando en ${Math.round(wait / 1000)} s`)
      setTimeout(connect, wait)
    })
    client.on('exists', () => {
      // Una comprobación a la vez, en orden.
      work = work.then(check).catch((err) => console.warn('[nova] gmail:', err.message))
    })
    try {
      await client.connect()
      await client.mailboxOpen('INBOX') // abierto = IDLE automático
      lastUid = (client.mailbox.uidNext ?? 1) - 1 // solo correos nuevos desde ahora
      retry = 0
      console.log(`[nova] vigilando Gmail de ${user} (${[...senders].join(', ')})`)
    } catch (err) {
      console.warn('[nova] no se pudo conectar a Gmail:', err.responseText || err.message)
      if (err.authenticationFailed) {
        stopped = true // reintentar con una clave mala solo consigue que Google bloquee la cuenta
        console.warn('[nova] revisa GMAIL_USER y GMAIL_APP_PASSWORD (debe ser una contraseña de aplicación).')
      }
      try { client.close() } catch {}
    }
  }

  void connect()
  return () => {
    stopped = true
    try { client?.close() } catch {}
  }
}
