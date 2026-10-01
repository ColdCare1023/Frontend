/**
 * Servicio mock para recuperación y restablecimiento de contraseña.
 * Implementa retardo uniforme anti-enumeración para prevenir detección de
 * existencia de usuarios mediante análisis de tiempos (timing attacks).
 */

export interface ResultadoSolicitud {
  success: boolean
  message: string
}

export interface ResultadoValidacionToken {
  valido: boolean
  email?: string
}

export interface ResultadoRestablecimiento {
  success: boolean
  error?: string
}

const DELAY_MS = 450

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export class MockPasswordRecoveryService {
  /**
   * Almacén en memoria de tokens de restablecimiento activos para el entorno demo.
   * Asocia token -> email.
   */
  private tokensValidos = new Map<string, string>([
    ['demo-recovery-token', 'farmaceutico@demo.pe'],
    ['token-valido-123', 'admin@demo.pe'],
  ])

  /**
   * Solicita el envío de instrucciones de recuperación.
   * Aplica un retardo uniforme y responde siempre con éxito para evitar la
   * enumeración de cuentas registradas.
   */
  async solicitarInstrucciones(email: string): Promise<ResultadoSolicitud> {
    await delay(DELAY_MS)

    const normalizado = email.trim().toLowerCase()
    const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!regexEmail.test(normalizado)) {
      return {
        success: false,
        message: 'correo_invalido',
      }
    }

    // Se genera un token de sesión demo para poder completar el flujo de prueba
    const tokenGenerado = `recovery-${Math.random().toString(36).slice(2, 10)}`
    this.tokensValidos.set(tokenGenerado, normalizado)

    return {
      success: true,
      message: 'instrucciones_enviadas',
    }
  }

  /**
   * Valida si un token de recuperación existe y no ha expirado.
   */
  async validarToken(token: string): Promise<ResultadoValidacionToken> {
    await delay(DELAY_MS)

    if (!token || !token.trim()) {
      return { valido: false }
    }

    const email = this.tokensValidos.get(token.trim())
    if (!email && token.trim() !== 'demo-recovery-token') {
      return { valido: false }
    }

    return {
      valido: true,
      email: email ?? 'farmaceutico@demo.pe',
    }
  }

  /**
   * Restablece la contraseña asociada al token.
   */
  async restablecerContrasena(
    token: string,
    nuevaPassword: string,
  ): Promise<ResultadoRestablecimiento> {
    await delay(DELAY_MS)

    const validacion = await this.validarToken(token)
    if (!validacion.valido) {
      return {
        success: false,
        error: 'token_invalido',
      }
    }

    if (!nuevaPassword || nuevaPassword.length < 8) {
      return {
        success: false,
        error: 'password_debil',
      }
    }

    // Se consume el token tras el uso
    this.tokensValidos.delete(token.trim())

    return { success: true }
  }
}

export const mockPasswordRecoveryService = new MockPasswordRecoveryService()
