import { Bell, FileText, History, Link2, ListChecks, Monitor, ScrollText, ServerCog, SlidersHorizontal, Users, type LucideIcon } from 'lucide-react'

import type { Rol } from '@/domain/value-objects/Rol'

export type GrupoId = 'vigilar' | 'consultar' | 'administrar'

export interface Seccion {
  ruta: string
  icono: LucideIcon
  tituloKey: string
  descripcionKey: string
  grupo: GrupoId
  roles: Rol[]
}

/** Pantallas por rol: los mismos `roles` que las rutas protegidas (`tienePermiso`). */
export const SECCIONES: Seccion[] = [
  { ruta: '/dashboard', icono: Monitor, tituloKey: 'guia.pantallas.monitoreo.titulo', descripcionKey: 'guia.pantallas.monitoreo.descripcion', grupo: 'vigilar', roles: ['farmaceutico', 'tecnico', 'auditor'] },
  { ruta: '/alertas', icono: Bell, tituloKey: 'guia.pantallas.alertas.titulo', descripcionKey: 'guia.pantallas.alertas.descripcion', grupo: 'vigilar', roles: ['farmaceutico', 'tecnico', 'auditor'] },
  { ruta: '/historial', icono: History, tituloKey: 'guia.pantallas.historial.titulo', descripcionKey: 'guia.pantallas.historial.descripcion', grupo: 'consultar', roles: ['farmaceutico', 'tecnico', 'auditor'] },
  { ruta: '/trazabilidad', icono: Link2, tituloKey: 'guia.pantallas.integridad.titulo', descripcionKey: 'guia.pantallas.integridad.descripcion', grupo: 'consultar', roles: ['farmaceutico', 'tecnico', 'auditor'] },
  { ruta: '/reportes', icono: FileText, tituloKey: 'guia.pantallas.reportes.titulo', descripcionKey: 'guia.pantallas.reportes.descripcion', grupo: 'consultar', roles: ['farmaceutico', 'auditor'] },
  { ruta: '/metricas-ia', icono: ListChecks, tituloKey: 'guia.pantallas.metricas.titulo', descripcionKey: 'guia.pantallas.metricas.descripcion', grupo: 'consultar', roles: ['farmaceutico', 'auditor'] },
  { ruta: '/auditoria', icono: ScrollText, tituloKey: 'guia.pantallas.auditoria.titulo', descripcionKey: 'guia.pantallas.auditoria.descripcion', grupo: 'consultar', roles: ['auditor'] },
  { ruta: '/usuarios', icono: Users, tituloKey: 'guia.pantallas.usuarios.titulo', descripcionKey: 'guia.pantallas.usuarios.descripcion', grupo: 'administrar', roles: [] },
  { ruta: '/dispositivos', icono: SlidersHorizontal, tituloKey: 'guia.pantallas.dispositivos.titulo', descripcionKey: 'guia.pantallas.dispositivos.descripcion', grupo: 'administrar', roles: [] },
  { ruta: '/estado-servicio', icono: ServerCog, tituloKey: 'guia.pantallas.estadoServicio.titulo', descripcionKey: 'guia.pantallas.estadoServicio.descripcion', grupo: 'administrar', roles: [] },
]

export const GRUPOS: GrupoId[] = ['vigilar', 'consultar', 'administrar']

export const CONCEPTOS = ['rango', 'preventivo', 'excursion', 'integridad', 'bpa'] as const

export const PASOS = ['inicio', 'estados', 'alertas', 'pantallas', 'conceptos'] as const
export type PasoId = (typeof PASOS)[number]

/** Título de cada paso (las claves ya existentes de cada sección). */
export const TITULO_PASO: Record<PasoId, string> = {
  inicio: 'guia.inicioTitulo',
  estados: 'guia.estadosTitulo',
  alertas: 'guia.alertaTitulo',
  pantallas: 'guia.pantallasTitulo',
  conceptos: 'guia.conceptosTitulo',
}

/** Etiqueta corta en el stepper. */
export const ETIQUETA_PASO: Record<PasoId, string> = {
  inicio: 'guia.nav.inicio',
  estados: 'guia.nav.estados',
  alertas: 'guia.nav.alertas',
  pantallas: 'guia.nav.pantallas',
  conceptos: 'guia.nav.conceptos',
}

/** Anclajes antiguos (`#guia-*-titulo`) → paso. */
export const ANCLAS_ANTIGUAS: Record<string, PasoId> = {
  'guia-inicio-titulo': 'inicio',
  'guia-estados-titulo': 'estados',
  'guia-alerta-titulo': 'alertas',
  'guia-pantallas-titulo': 'pantallas',
  'guia-conceptos-titulo': 'conceptos',
}

export function esPaso(valor: string | null | undefined): valor is PasoId {
  return Boolean(valor) && (PASOS as readonly string[]).includes(valor as string)
}
