import { Activity, Bell, BookOpen, Brain, FileText, HardDrive, History, Link2, ScrollText, Users, type LucideIcon } from 'lucide-react'

import { tienePermiso, type Rol } from '@/domain/value-objects/Rol'

export interface ItemNav {
  ruta: string
  icono: LucideIcon
  claveI18n: string
  /** Línea de la pantalla sin permiso («Puedes continuar en…»). */
  claveDescripcion: string
  roles: Rol[]
}

export interface SeccionNav {
  claveI18n: string
  items: ItemNav[]
}

/**
 * Mapa de navegación (HU-41). Compartido por el riel, el cajón móvil, la
 * cabecera (ruta de migas) y la pantalla sin permiso. Los roles son los
 * mismos que exigen las rutas en App.tsx y el backend; el administrador pasa
 * todo (`tienePermiso`).
 */
export const SECCIONES: SeccionNav[] = [
  {
    claveI18n: 'nav.seccionOperacion',
    items: [
      // El tablero va primero: responde de inmediato cómo está el refrigerador.
      // HU-41: AUDITOR entra aquí explícitamente en dashboard/historial/
      // alertas/trazabilidad — el backend le da lectura sobre los mismos
      // endpoints (lecturas_router, alertas_router, trazabilidad_router).
      { ruta: '/dashboard', icono: Activity, claveI18n: 'nav.dashboard', claveDescripcion: 'nav.descripciones.dashboard', roles: ['farmaceutico', 'tecnico', 'auditor'] },
      { ruta: '/alertas', icono: Bell, claveI18n: 'nav.alertas', claveDescripcion: 'nav.descripciones.alertas', roles: ['farmaceutico', 'tecnico', 'auditor'] },
      { ruta: '/historial', icono: History, claveI18n: 'nav.historial', claveDescripcion: 'nav.descripciones.historial', roles: ['farmaceutico', 'tecnico', 'auditor'] },
      { ruta: '/guia', icono: BookOpen, claveI18n: 'nav.guia', claveDescripcion: 'nav.descripciones.guia', roles: ['farmaceutico', 'tecnico', 'auditor'] },
    ],
  },
  {
    claveI18n: 'nav.seccionCumplimiento',
    items: [
      { ruta: '/trazabilidad', icono: Link2, claveI18n: 'nav.trazabilidad', claveDescripcion: 'nav.descripciones.trazabilidad', roles: ['farmaceutico', 'tecnico', 'auditor'] },
      { ruta: '/reportes', icono: FileText, claveI18n: 'nav.reportes', claveDescripcion: 'nav.descripciones.reportes', roles: ['farmaceutico', 'auditor'] },
      { ruta: '/metricas-ia', icono: Brain, claveI18n: 'nav.metricasIA', claveDescripcion: 'nav.descripciones.metricasIA', roles: ['farmaceutico', 'auditor'] },
    ],
  },
  {
    claveI18n: 'nav.seccionAdministracion',
    items: [
      // HU-41: auditoria sí es de AUDITOR (require_roles(ADMINISTRADOR,
      // AUDITOR) en auditoria_router.py) — el resto de esta sección sigue
      // siendo exclusiva del administrador.
      { ruta: '/auditoria', icono: ScrollText, claveI18n: 'nav.auditoria', claveDescripcion: 'nav.descripciones.auditoria', roles: ['auditor'] },
      { ruta: '/usuarios', icono: Users, claveI18n: 'nav.usuarios', claveDescripcion: 'nav.descripciones.usuarios', roles: [] },
      { ruta: '/dispositivos', icono: HardDrive, claveI18n: 'nav.dispositivos', claveDescripcion: 'nav.descripciones.dispositivos', roles: [] },
    ],
  },
]

/** Secciones con solo los destinos que el rol puede abrir (las vacías se omiten). */
export function seccionesPermitidas(rol: Rol): SeccionNav[] {
  return SECCIONES.map((s) => ({ ...s, items: s.items.filter((i) => tienePermiso(rol, i.roles)) })).filter((s) => s.items.length > 0)
}

/** Sección e ítem de la ruta actual (también para subrutas como /dispositivos/:id). */
export function ubicarRuta(pathname: string): { seccion: SeccionNav; item: ItemNav } | null {
  for (const seccion of SECCIONES) {
    const item = seccion.items.find((i) => pathname === i.ruta || pathname.startsWith(`${i.ruta}/`))
    if (item) return { seccion, item }
  }
  return null
}
