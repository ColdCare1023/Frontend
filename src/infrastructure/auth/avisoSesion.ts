/**
 * Aviso contextual en el login. El JWT vive solo en memoria (mitigación XSS),
 * así que recargar la página pierde la sesión; estos flags — simples marcas,
 * jamás el token — permiten explicárselo al usuario en vez de expulsarlo
 * en silencio. sessionStorage sobrevive a la recarga pero no a cerrar la pestaña.
 */
const CLAVE_SESION_PREVIA = 'cf_sesion_previa'
const CLAVE_MOTIVO = 'cf_aviso_login'

export type MotivoAviso = 'recarga' | 'expirada' | null

export function marcarSesionActiva(): void {
  sessionStorage.setItem(CLAVE_SESION_PREVIA, '1')
}

export function limpiarSesionActiva(): void {
  sessionStorage.removeItem(CLAVE_SESION_PREVIA)
}

export function marcarSesionExpirada(): void {
  sessionStorage.setItem(CLAVE_MOTIVO, 'expirada')
}

/** Consume (lee y borra) el motivo por el que el usuario volvió al login. */
export function consumirMotivoAviso(): MotivoAviso {
  const expirada = sessionStorage.getItem(CLAVE_MOTIVO) === 'expirada'
  const habiaSesion = sessionStorage.getItem(CLAVE_SESION_PREVIA) === '1'
  sessionStorage.removeItem(CLAVE_MOTIVO)
  sessionStorage.removeItem(CLAVE_SESION_PREVIA)
  if (expirada) return 'expirada'
  if (habiaSesion) return 'recarga'
  return null
}
