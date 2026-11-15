/**
 * Códigos de verificación por correo (backend: docs/operacion/CODIGOS_VERIFICACION.md).
 *
 * Tres flujos comparten el mismo código de 6 dígitos: el segundo factor del
 * login con contraseña, la recuperación de contraseña y la activación de una
 * cuenta creada por un administrador.
 */
export const LONGITUD_CODIGO = 6

/**
 * Login pendiente: la contraseña fue correcta pero la sesión se abre recién al
 * canjear `desafio` + código en POST /api/auth/login/verificar.
 */
export interface DesafioCodigo {
  /** Opaco y de un solo uso; nunca se muestra ni se persiste. */
  desafio: string
  /** El backend ya lo devuelve enmascarado (`a***@farmacia.pe`). */
  emailEnmascarado: string
  /** Vigencia del código recién enviado. */
  expiraEnSegundos: number
  /** Espera mínima antes de poder pedir otro código. */
  reenviarEnSegundos: number
}

/**
 * Por qué no se aceptó un código. El backend responde con mensajes genéricos
 * (sin códigos de error); la infraestructura los traduce a este vocabulario.
 */
export type MotivoRechazoCodigo =
  /** Código equivocado: se puede reintentar con el mismo desafío. */
  | 'incorrecto'
  /** Se quemó el código tras 5 fallos: hay que volver a iniciar sesión. */
  | 'agotado'
  /** Desafío vencido, usado o inexistente: hay que volver a iniciar sesión. */
  | 'caducado'
  /** La cuenta superó su cuota de fallos con códigos. */
  | 'bloqueado'
  /** 429 por cuota (incluye la espera entre reenvíos). */
  | 'limite'
  /** 503: el servidor no pudo enviar el correo. */
  | 'no_disponible'
  | 'error'

/** Deja solo dígitos (el backend acepta espacios o guiones al pegar). */
export function normalizarCodigo(texto: string, longitud = LONGITUD_CODIGO): string {
  return texto.replace(/\D/g, '').slice(0, longitud)
}

export function codigoCompleto(codigo: string, longitud = LONGITUD_CODIGO): boolean {
  return new RegExp(`^\\d{${longitud}}$`).test(codigo)
}

/**
 * Código que viaja en el fragmento del enlace «Copiar código» de los correos
 * (`/copiar-codigo#123456`). El fragmento nunca llega al servidor ni a los
 * registros de acceso. Solo se acepta exactamente el código, sin normalizar:
 * un fragmento con cualquier otra cosa no es un enlace de ColdCare.
 */
export function codigoDesdeFragmento(fragmento: string): string | null {
  const coincidencia = /^#(\d+)$/.exec(fragmento)
  return coincidencia && codigoCompleto(coincidencia[1]) ? coincidencia[1] : null
}

/**
 * Código que traen los botones «Escribir el código» y «Activar mi cuenta» de
 * los correos (`/recuperar-contrasena?modo=…&email=…#codigo=123456`): la
 * pantalla lo rellena sola. Mismo criterio que `codigoDesdeFragmento`: solo el
 * código exacto, o nada.
 */
export function codigoDesdeEnlace(fragmento: string): string | null {
  const coincidencia = /^#codigo=(\d+)$/.exec(fragmento)
  return coincidencia && codigoCompleto(coincidencia[1]) ? coincidencia[1] : null
}
