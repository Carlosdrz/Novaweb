/** Hogar inteligente vía Home Assistant. Requiere HA_URL y HA_TOKEN en el servidor (nunca en la página). */
import { z } from 'zod'
import { permiso, defTool, createSdkMcpServer, ok, comoDatos } from './seguridad.mjs'

export const casaConfigurada = () => Boolean(process.env.HA_URL && process.env.HA_TOKEN)
const DOMINIOS = new Set(['light', 'switch', 'fan', 'input_boolean'])
async function ha(ruta, init = {}) {
  const r = await fetch(`${process.env.HA_URL.replace(/\/$/, '')}/api/${ruta}`, { ...init, headers: { authorization: `Bearer ${process.env.HA_TOKEN}`, 'content-type': 'application/json' }, signal: AbortSignal.timeout(8000) })
  if (!r.ok) throw new Error(`Home Assistant respondió ${r.status}`)
  return r.json()
}
export async function estado(entity) { return ha(`states/${encodeURIComponent(entity)}`) }
export async function listar(dominio) { const l = await ha('states'); return l.filter((e) => !dominio || e.entity_id.startsWith(dominio + '.')).map((e) => `${e.entity_id}: ${e.state}${e.attributes?.friendly_name ? ' (' + e.attributes.friendly_name + ')' : ''}`) }
/** Actúa y VERIFICA el resultado leyendo el estado después. */
export async function accionar(entity, accion) {
  const dom = entity.split('.')[0]; if (!DOMINIOS.has(dom)) throw new Error(`solo controlo ${[...DOMINIOS].join(', ')}`)
  const srv = { on: 'turn_on', off: 'turn_off', toggle: 'toggle' }[accion]; if (!srv) throw new Error('acción inválida')
  await ha(`services/${dom}/${srv}`, { method: 'POST', body: JSON.stringify({ entity_id: entity }) })
  await new Promise((r) => setTimeout(r, 600))
  return (await estado(entity)).state
}
const P = { permiso: 'casa', etiqueta: 'Hogar inteligente' }
export function casaServer() {
  return createSdkMcpServer({
    name: 'nova_casa', version: '1.0.0',
    tools: [
      defTool('home_list', 'List smart-home devices and their state (optionally one domain: light, switch, fan).', { domain: z.string().optional() }, { ...P, detalle: () => 'Listar dispositivos' }, async ({ domain }) => ok(comoDatos('Home Assistant', (await listar(domain)).join('\n') || 'Sin dispositivos.'))),
      defTool('home_state', 'Current state of one device.', { entity_id: z.string() }, { ...P, detalle: (a) => `Estado de ${a.entity_id}` }, async ({ entity_id }) => ok(`${entity_id}: ${(await estado(entity_id)).state}`)),
      defTool('home_set', 'Turn a light/switch/fan on, off or toggle. Reports the verified state afterwards.', { entity_id: z.string(), action: z.enum(['on', 'off', 'toggle']) }, { ...P, detalle: (a) => `${a.action} ${a.entity_id}` }, async ({ entity_id, action }) => ok(`${entity_id} ahora está: ${await accionar(entity_id, action)} (verificado).`)),
    ],
  })
}
