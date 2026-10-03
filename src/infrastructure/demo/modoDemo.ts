/**
 * Modo demostración: toda la aplicación funciona con datos simulados en
 * memoria, sin conectarse al backend. Activo por defecto salvo que se
 * configure explícitamente `VITE_MODO_DEMO=false` para conectar al backend real.
 */
export const MODO_DEMO = import.meta.env.VITE_MODO_DEMO !== 'false'
