/** Notas y tareas de Nova: archivos JSON en DATA_DIR, con herramientas para el asistente y funciones para la pantalla. */
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { DATA_DIR, readJson, writeAtomic, defTool, createSdkMcpServer, ok, denegado, confirmar } from './seguridad.mjs'

const NOTAS = () => join(DATA_DIR(), 'notas.json')
const TAREAS = () => join(DATA_DIR(), 'tareas.json')
const id = () => randomBytes(3).toString('hex')
const limpio = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n)

export const listarNotas = () => readJson(NOTAS(), [])
export function agregarNota(texto, titulo = '') {
  const t = limpio(texto, 4000); if (!t) throw new Error('la nota está vacía')
  const l = listarNotas(); if (l.length >= 500) throw new Error('hay demasiadas notas')
  const n = { id: id(), titulo: limpio(titulo, 80), texto: t, creada: Date.now() }
  l.push(n); writeAtomic(NOTAS(), JSON.stringify(l, null, 2)); return n
}
export function borrarNota(q) {
  const k = String(q).toLowerCase(), l = listarNotas()
  const fuera = l.filter((n) => n.id === k || n.titulo.toLowerCase().includes(k) || n.texto.toLowerCase().includes(k))
  if (fuera.length) writeAtomic(NOTAS(), JSON.stringify(l.filter((n) => !fuera.includes(n)), null, 2))
  return fuera
}

export const listarTareas = () => readJson(TAREAS(), [])
export function agregarTarea(texto, vence = '') {
  const t = limpio(texto, 300); if (!t) throw new Error('la tarea está vacía')
  const l = listarTareas(); if (l.length >= 500) throw new Error('hay demasiadas tareas')
  const n = { id: id(), texto: t, vence: limpio(vence, 40), hecha: false, creada: Date.now() }
  l.push(n); writeAtomic(TAREAS(), JSON.stringify(l, null, 2)); return n
}
export function cambiarTarea(q, hecha = true) {
  const k = String(q).toLowerCase(), l = listarTareas()
  const m = l.filter((n) => n.id === k || n.texto.toLowerCase().includes(k))
  for (const n of m) n.hecha = hecha
  if (m.length) writeAtomic(TAREAS(), JSON.stringify(l, null, 2))
  return m
}
export function borrarTarea(q) {
  const k = String(q).toLowerCase(), l = listarTareas()
  const fuera = l.filter((n) => n.id === k || n.texto.toLowerCase().includes(k))
  if (fuera.length) writeAtomic(TAREAS(), JSON.stringify(l.filter((n) => !fuera.includes(n)), null, 2))
  return fuera
}

const P = { permiso: 'notas', etiqueta: 'Notas y tareas' }
export function notasServer() {
  return createSdkMcpServer({
    name: 'nova_notas', version: '1.0.0',
    tools: [
      defTool('add_note', 'Save a note for the user (text they dictate or ask you to write down).', { text: z.string(), title: z.string().optional() }, { ...P, detalle: (a) => `Nota: ${String(a.text).slice(0, 60)}` },
        async ({ text, title }) => ok(`Nota guardada (${agregarNota(text, title).id}).`)),
      defTool('list_notes', 'List the saved notes.', {}, { ...P, detalle: () => 'Listar notas' }, async () => {
        const l = listarNotas(); return ok(l.length ? l.map((n) => `${n.id}: ${n.titulo ? n.titulo + ' — ' : ''}${n.texto}`).join('\n') : 'No hay notas.')
      }),
      defTool('delete_note', 'Delete notes by id or a word in them. Asks the user to confirm first.', { query: z.string() }, { ...P, detalle: (a) => `Borrar nota: ${a.query}` }, async ({ query }) => {
        if (!(await confirmar({ titulo: 'Borrar nota', detalle: `Se borrarán las notas que contengan «${query}».` }))) return denegado('El Señor no autorizó borrar.')
        const g = borrarNota(query); return ok(g.length ? `Borradas ${g.length}.` : 'No encontré esa nota.')
      }),
      defTool('add_task', 'Add a to-do item. due is optional free text like "viernes".', { text: z.string(), due: z.string().optional() }, { ...P, detalle: (a) => `Tarea: ${String(a.text).slice(0, 60)}` },
        async ({ text, due }) => ok(`Tarea guardada (${agregarTarea(text, due).id}).`)),
      defTool('list_tasks', 'List to-do items (pending first).', {}, { ...P, detalle: () => 'Listar tareas' }, async () => {
        const l = listarTareas().sort((a, b) => a.hecha - b.hecha)
        return ok(l.length ? l.map((t) => `${t.id}: [${t.hecha ? 'x' : ' '}] ${t.texto}${t.vence ? ' (' + t.vence + ')' : ''}`).join('\n') : 'No hay tareas.')
      }),
      defTool('complete_task', 'Mark tasks as done by id or a word in them.', { query: z.string() }, { ...P, detalle: (a) => `Completar: ${a.query}` },
        async ({ query }) => { const m = cambiarTarea(query, true); return ok(m.length ? `Hecho: ${m.map((t) => t.texto).join('; ')}` : 'No encontré esa tarea.') }),
      defTool('delete_task', 'Delete tasks by id or word. Asks the user to confirm first.', { query: z.string() }, { ...P, detalle: (a) => `Borrar tarea: ${a.query}` }, async ({ query }) => {
        if (!(await confirmar({ titulo: 'Borrar tarea', detalle: `Se borrarán las tareas que contengan «${query}».` }))) return denegado('El Señor no autorizó borrar.')
        const g = borrarTarea(query); return ok(g.length ? `Borradas ${g.length}.` : 'No encontré esa tarea.')
      }),
    ],
  })
}
