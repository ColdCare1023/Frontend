/**
 * FE-011: registro de errores de la interfaz.
 *
 * Un error capturado puede llevar en su mensaje o en su stack datos de la API
 * (lecturas, correos, identificadores). En los equipos compartidos de la
 * farmacia la consola del navegador queda al alcance de cualquiera, así que
 * en producción solo se registra el tipo de error. En desarrollo se conserva
 * el detalle completo para depurar.
 *
 * Se usa como `onCaughtError`/`onUncaughtError` de `createRoot`: React 19 en
 * producción imprime por defecto el error capturado completo.
 */
export function registrarErrorDeInterfaz(error: unknown, info?: { componentStack?: string }): void {
  if (import.meta.env.DEV) {
    console.error('[ErrorBoundary]', error, info?.componentStack)
    return
  }
  const tipo = error instanceof Error ? error.name : typeof error
  console.error(`[ColdCare] Error de interfaz (${tipo}). Detalle omitido en producción.`)
}
