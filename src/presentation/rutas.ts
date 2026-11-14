/**
 * Cargadores de las rutas protegidas, compartidos por App.tsx (React.lazy) y
 * la navegación (precarga al pasar el cursor o enfocar un enlace). Importar un
 * módulo dos veces no lo descarga dos veces: el navegador reusa la promesa.
 */
export const CARGADORES: Record<string, () => Promise<unknown>> = {
  '/dashboard': () => import('@/presentation/pages/DashboardPage'),
  '/alertas': () => import('@/presentation/pages/AlertasPage'),
  '/historial': () => import('@/presentation/pages/HistorialPage'),
  '/guia': () => import('@/presentation/pages/GuiaPage'),
  '/trazabilidad': () => import('@/presentation/pages/TrazabilidadPage'),
  '/reportes': () => import('@/presentation/pages/ReportesPage'),
  '/metricas-ia': () => import('@/presentation/pages/MetricasIAPage'),
  '/auditoria': () => import('@/presentation/pages/AuditoriaPage'),
  '/usuarios': () => import('@/presentation/pages/UsuariosPage'),
  '/dispositivos': () =>
    Promise.all([
      import('@/presentation/pages/dispositivos/DispositivosLayout'),
      import('@/presentation/pages/dispositivos/ListaDispositivosPage'),
    ]),
}

const precargadas = new Set<string>()

/** Descarga el chunk de una ruta en segundo plano (sin ahorro de datos). */
export function precargarRuta(ruta: string): void {
  if (precargadas.has(ruta)) return
  const cargar = CARGADORES[ruta]
  if (!cargar) return
  const conexion = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  if (conexion?.saveData) return
  precargadas.add(ruta)
  cargar().catch(() => precargadas.delete(ruta))
}
