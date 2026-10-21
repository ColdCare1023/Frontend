/**
 * Modo demostración: toda la aplicación funciona con datos simulados en
 * memoria, sin conectarse al backend.
 *
 * FE-002: fallo cerrado. Solo se activa con `VITE_MODO_DEMO=true` exacto (lo
 * fijan `--mode demo` o la variable de entorno; ver vite.config.ts). Antes
 * bastaba con que la variable faltara para que una compilación "de
 * producción" mostrara temperaturas simuladas como si fueran reales.
 */
export const MODO_DEMO = import.meta.env.VITE_MODO_DEMO === 'true'
