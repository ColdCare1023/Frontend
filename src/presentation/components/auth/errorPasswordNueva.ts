import { problemaPassword } from '@/domain/value-objects/politicaPassword'

/** Mensaje de error de la política, o null si la contraseña es aceptable. */
export function errorPasswordNueva(
  t: (clave: string) => string,
  password: string,
  confirmacion: string,
): string | null {
  const problema = problemaPassword(password)
  if (problema) return t(`restablecerContrasena.politica.${problema}`)
  if (password !== confirmacion) return t('restablecerContrasena.errorCoincidencia')
  return null
}
