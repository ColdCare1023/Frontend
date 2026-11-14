/**
 * Contraseña provisional para el alta de usuarios: 16 caracteres de
 * `crypto.getRandomValues` sobre letras y dígitos sin los ambiguos (0/O,
 * 1/l/I), con al menos una letra y un dígito. Cumple `PasswordNueva` (≥10,
 * letras y números, ≤72 bytes) por construcción.
 */
const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const DIGITOS = '23456789'
export const ALFABETO_PROVISIONAL = LETRAS + DIGITOS

function indiceAleatorio(maximo: number): number {
  // Rechazo para evitar sesgo de módulo.
  const limite = Math.floor(0x1_0000_0000 / maximo) * maximo
  const buffer = new Uint32Array(1)
  for (;;) {
    crypto.getRandomValues(buffer)
    if (buffer[0] < limite) return buffer[0] % maximo
  }
}

export function generarPasswordProvisional(longitud = 16): string {
  const caracteres = Array.from({ length: longitud }, () => ALFABETO_PROVISIONAL[indiceAleatorio(ALFABETO_PROVISIONAL.length)])
  // Garantiza una letra y un dígito en posiciones distintas.
  const posLetra = indiceAleatorio(longitud)
  let posDigito = indiceAleatorio(longitud - 1)
  if (posDigito >= posLetra) posDigito += 1
  caracteres[posLetra] = LETRAS[indiceAleatorio(LETRAS.length)]
  caracteres[posDigito] = DIGITOS[indiceAleatorio(DIGITOS.length)]
  return caracteres.join('')
}
