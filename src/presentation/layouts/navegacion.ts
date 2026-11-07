import { Activity, Bell, BookOpen, Brain, FileText, HardDrive, History, Link2, ScrollText, Users } from 'lucide-react'

import { tienePermiso, type Rol } from '@/domain/value-objects/Rol'

export interface ItemNav {
  ruta: string
  icono: React.ComponentType<{ className?: string }>
  claveI18n: string
  roles: Rol[]
  /** Pantalla principal: va directa en la cápsula, arriba o abajo; el resto, en «Más». */
  enCapsula?: boolean
  /** Lo que dice en «Más», en una línea, para quien no conoce el nombre. */
  claveDetalle?: string
}

export interface SeccionNav {
  claveI18n: string
  items: ItemNav[]
}

/** Las pantallas y quién las ve. La navegación y la tabla de permisos leen de aquí. */
export const SECCIONES: SeccionNav[] = [
  {
    claveI18n: 'nav.seccionOperacion',
    items: [
      // El tablero va primero: responde de inmediato cómo está el refrigerador.
      // HU-41: AUDITOR entra aquí explícitamente en dashboard/historial/
      // alertas/trazabilidad — el backend le da lectura sobre los mismos
      // endpoints (lecturas_router, alertas_router, trazabilidad_router).
      { ruta: '/dashboard', icono: Activity, claveI18n: 'nav.dashboard', roles: ['farmaceutico', 'tecnico', 'auditor'], enCapsula: true },
      { ruta: '/alertas', icono: Bell, claveI18n: 'nav.alertas', roles: ['farmaceutico', 'tecnico', 'auditor'], enCapsula: true },
      { ruta: '/historial', icono: History, claveI18n: 'nav.historial', roles: ['farmaceutico', 'tecnico', 'auditor'], enCapsula: true },
      { ruta: '/guia', icono: BookOpen, claveI18n: 'nav.guia', claveDetalle: 'nav.detalle.guia', roles: ['farmaceutico', 'tecnico', 'auditor'] },
    ],
  },
  {
    claveI18n: 'nav.seccionCumplimiento',
    items: [
      { ruta: '/trazabilidad', icono: Link2, claveI18n: 'nav.trazabilidad', claveDetalle: 'nav.detalle.trazabilidad', roles: ['farmaceutico', 'tecnico', 'auditor'] },
      { ruta: '/reportes', icono: FileText, claveI18n: 'nav.reportes', roles: ['farmaceutico', 'auditor'], enCapsula: true },
      { ruta: '/metricas-ia', icono: Brain, claveI18n: 'nav.metricasIA', claveDetalle: 'nav.detalle.metricasIA', roles: ['farmaceutico', 'auditor'] },
    ],
  },
  {
    claveI18n: 'nav.seccionAdministracion',
    items: [
      // HU-41: auditoria sí es de AUDITOR (require_roles(ADMINISTRADOR,
      // AUDITOR) en auditoria_router.py) — el resto de esta sección sigue
      // siendo exclusiva del administrador.
      { ruta: '/auditoria', icono: ScrollText, claveI18n: 'nav.auditoria', claveDetalle: 'nav.detalle.auditoria', roles: ['auditor'] },
      { ruta: '/usuarios', icono: Users, claveI18n: 'nav.usuarios', claveDetalle: 'nav.detalle.usuarios', roles: [] },
      { ruta: '/dispositivos', icono: HardDrive, claveI18n: 'nav.dispositivos', claveDetalle: 'nav.detalle.dispositivos', roles: [] },
    ],
  },
]

/** Las secciones y pantallas que ve un rol, sin secciones vacías. */
export function seccionesVisibles(rol: Rol): SeccionNav[] {
  return SECCIONES.map((seccion) => ({ ...seccion, items: seccion.items.filter((item) => tienePermiso(rol, item.roles)) })).filter(
    (seccion) => seccion.items.length > 0,
  )
}

/** Orden de «Más»: primero lo que cualquiera usa, luego lo de cada rol. */
const ORDEN_MAS = ['/trazabilidad', '/metricas-ia', '/guia', '/auditoria', '/usuarios', '/dispositivos']

/** Lo que un rol ve en la cápsula y en «Más». Lo que no le toca no aparece: ni deja hueco. */
export function navegacionDe(rol: Rol): { principales: ItemNav[]; mas: ItemNav[] } {
  const visibles = seccionesVisibles(rol).flatMap((seccion) => seccion.items)
  return {
    principales: visibles.filter((item) => item.enCapsula),
    mas: visibles.filter((item) => !item.enCapsula).sort((a, b) => ORDEN_MAS.indexOf(a.ruta) - ORDEN_MAS.indexOf(b.ruta)),
  }
}

/** Si un rol puede abrir una ruta de la navegación. */
export function puedeVerRuta(rol: Rol, ruta: string): boolean {
  return seccionesVisibles(rol).some((seccion) => seccion.items.some((item) => item.ruta === ruta))
}
