/**
 * Modo demostración: toda la aplicación funciona con datos simulados en
 * memoria, sin conectarse al backend. Se activa en build con
 * `VITE_MODO_DEMO=true` (ver script `build:demo` y `.env.demo`).
 */
export const MODO_DEMO = import.meta.env.VITE_MODO_DEMO === 'true'
