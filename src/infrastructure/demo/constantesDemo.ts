/**
 * FE-009: constantes del modo demo sin efectos secundarios. Importar
 * datosDemo.ts desde una pantalla arrastraría al bundle de producción la
 * generación de datos y el catálogo de cuentas demo.
 */
export const DISPOSITIVO_DEMO = 'FARM-01-CDL'

/**
 * Código de verificación de la demostración (login con código, recuperación y
 * activación). La demo no envía correos: la pantalla lo muestra como ayuda.
 */
export const CODIGO_VERIFICACION_DEMO = '123456'
