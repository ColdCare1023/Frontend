import { describe, expect, it } from 'vitest'
import { MockPasswordRecoveryService } from '@/infrastructure/auth/MockPasswordRecoveryService'

describe('MockPasswordRecoveryService', () => {
  it('rechaza solicitudes con correos inválidos', async () => {
    const service = new MockPasswordRecoveryService()
    const res = await service.solicitarInstrucciones('no-es-correo')
    expect(res.success).toBe(false)
    expect(res.message).toBe('correo_invalido')
  })

  it('acepta solicitudes con correos válidos sin revelar existencia (anti-enumeración)', async () => {
    const service = new MockPasswordRecoveryService()
    const res = await service.solicitarInstrucciones('cualquier.usuario@botica.pe')
    expect(res.success).toBe(true)
    expect(res.message).toBe('instrucciones_enviadas')
  })

  it('valida tokens conocidos de entorno demo', async () => {
    const service = new MockPasswordRecoveryService()
    const res = await service.validarToken('demo-recovery-token')
    expect(res.valido).toBe(true)
    expect(res.email).toBe('farmaceutico@demo.pe')
  })

  it('rechaza tokens no registrados o vacíos', async () => {
    const service = new MockPasswordRecoveryService()
    const resVacio = await service.validarToken('')
    expect(resVacio.valido).toBe(false)

    const resInvalido = await service.validarToken('token-inexistente-xyz')
    expect(resInvalido.valido).toBe(false)
  })

  it('rechaza contraseñas con longitud insuficiente (< 8 caracteres)', async () => {
    const service = new MockPasswordRecoveryService()
    const res = await service.restablecerContrasena('demo-recovery-token', 'corta')
    expect(res.success).toBe(false)
    expect(res.error).toBe('password_debil')
  })

  it('restablece exitosamente con token válido y consume el token', async () => {
    const service = new MockPasswordRecoveryService()
    const res = await service.restablecerContrasena('token-valido-123', 'NuevaClave-2026')
    expect(res.success).toBe(true)

    // El token debe haber sido consumido
    const revalidacion = await service.validarToken('token-valido-123')
    expect(revalidacion.valido).toBe(false)
  })
})
