/**
 * FE-004: la misma política que aplica el backend (`PasswordNueva`, BE-025):
 * al menos 10 caracteres, letras y dígitos, y no más de 72 bytes (límite de
 * los hashes bcrypt heredados). Validar aquí solo adelanta el mensaje; la
 * decisión es del servidor.
 */
export const PASSWORD_MIN_CARACTERES = 10
export const PASSWORD_MAX_BYTES = 72

export type ProblemaPassword = 'corta' | 'sin_letras_y_digitos' | 'demasiado_larga'

export function problemaPassword(password: string): ProblemaPassword | null {
  if (password.length < PASSWORD_MIN_CARACTERES) return 'corta'
  if (!/\p{L}/u.test(password) || !/\d/.test(password)) return 'sin_letras_y_digitos'
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) return 'demasiado_larga'
  return null
}
