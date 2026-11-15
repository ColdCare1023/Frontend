import { describe, expect, it } from 'vitest'
import type { InternalAxiosRequestConfig } from 'axios'

import type { AccionCorrectiva, AlertaTermica } from '@/domain/entities/AlertaTermica'
import { demoAdapter } from '@/infrastructure/demo/demoAdapter'
import { crearTokenDemo, estadoDemo } from '@/infrastructure/demo/datosDemo'

/**
 * La demo sigue al backend de fix/backlog-r2-alertas (HU-23/27, H16): solo el
 * farmacéutico (y el administrador) reconoce y registra la acción; sobre una
 * PENDIENTE, la acción la reconoce en el mismo instante y luego la atiende.
 */
function config(email: string | null, over: Partial<InternalAxiosRequestConfig>): InternalAxiosRequestConfig {
  const token = email ? `Bearer ${crearTokenDemo(email)}` : null
  return {
    headers: {
      get: (nombre: string) => (nombre.toLowerCase() === 'authorization' ? token : null),
      set: () => {},
      has: () => false,
      delete: () => {},
      clear: () => {},
      toJSON: () => ({}),
    } as unknown as InternalAxiosRequestConfig['headers'],
    method: 'get',
    url: '',
    ...over,
  } as InternalAxiosRequestConfig
}

async function estado(email: string | null, over: Partial<InternalAxiosRequestConfig>): Promise<number | undefined> {
  try {
    return (await demoAdapter(config(email, over))).status
  } catch (error) {
    return (error as { response?: { status?: number } }).response?.status
  }
}

const ACCION = JSON.stringify({ decision: 'Inmovilizar', descripcion: 'Se trasladó el lote', justificacion: 'Superó 8 °C' })

function nuevaPendiente(): AlertaTermica {
  const alerta: AlertaTermica = {
    ...estadoDemo.alertas[0],
    id: `al-prueba-${estadoDemo.alertas.length}`,
    estado: 'pendiente',
    revisada: false,
    revisada_por: null,
    reconocida_en: null,
    atendida_en: null,
  }
  estadoDemo.alertas.push(alerta)
  return alerta
}

describe('demo — HU-23/HU-27: acción correctiva y reconocimiento', () => {
  it('el técnico recibe 403 al registrar la acción y la alerta no cambia (H16)', async () => {
    const alerta = nuevaPendiente()
    const status = await estado('tecnico@demo.pe', { method: 'post', url: `/api/alertas/${alerta.id}/acciones-correctivas`, data: ACCION })

    expect(status).toBe(403)
    expect(alerta.estado).toBe('pendiente')
  })

  it('el técnico y el auditor reciben 403 al reconocer', async () => {
    const alerta = nuevaPendiente()
    expect(await estado('tecnico@demo.pe', { method: 'patch', url: `/api/alertas/${alerta.id}/revisar` })).toBe(403)
    expect(await estado('auditor@demo.pe', { method: 'patch', url: `/api/alertas/${alerta.id}/revisar` })).toBe(403)
    expect(alerta.estado).toBe('pendiente')
  })

  it('sobre una PENDIENTE, el farmacéutico la reconoce y la atiende en el mismo instante', async () => {
    const alerta = nuevaPendiente()
    const respuesta = await demoAdapter(
      config('farmaceutico@demo.pe', { method: 'post', url: `/api/alertas/${alerta.id}/acciones-correctivas`, data: ACCION }),
    )

    expect(respuesta.status).toBe(201)
    expect((respuesta.data as AccionCorrectiva).usuario_id).toBe('u-01')
    expect(alerta.estado).toBe('atendida')
    expect(alerta.revisada_por).toBe('u-01')
    expect(alerta.reconocida_en).not.toBeNull()
    expect(alerta.reconocida_en).toBe(alerta.atendida_en)

    const lista = await demoAdapter(config('farmaceutico@demo.pe', { url: '/api/alertas', params: { estado: 'atendida' } }))
    const devuelta = (lista.data as AlertaTermica[]).find((a) => a.id === alerta.id)!
    expect(devuelta.revisada_por_nombre).toBe('Farmacéutica Demo')
  })

  it('la lista entrega copias: atender después no cambia la PENDIENTE que la interfaz ya tiene', async () => {
    // Como una respuesta serializada del backend. Con el objeto del estado demo,
    // la actualización local de useAlertas veía la alerta ya ATENDIDA y le ponía
    // otra hora de atención (la cronología perdía «Reconocida al registrar…»).
    const alerta = nuevaPendiente()
    const lista = await demoAdapter(config('farmaceutico@demo.pe', { url: '/api/alertas', params: { estado: 'pendiente' } }))
    const enPantalla = (lista.data as AlertaTermica[]).find((a) => a.id === alerta.id)!
    expect(enPantalla).not.toBe(alerta)

    await demoAdapter(config('farmaceutico@demo.pe', { method: 'post', url: `/api/alertas/${alerta.id}/acciones-correctivas`, data: ACCION }))
    expect(alerta.estado).toBe('atendida')
    expect(enPantalla).toMatchObject({ estado: 'pendiente', reconocida_en: null, atendida_en: null })
  })

  it('el administrador también registra; una atendida responde 409', async () => {
    const alerta = nuevaPendiente()
    const url = `/api/alertas/${alerta.id}/acciones-correctivas`
    expect(await estado('admin@demo.pe', { method: 'post', url, data: ACCION })).toBe(201)
    expect(await estado('farmaceutico@demo.pe', { method: 'post', url, data: ACCION })).toBe(409)
  })

  it('sobre una RECONOCIDA conserva quién y cuándo la reconoció', async () => {
    const alerta = nuevaPendiente()
    expect(await estado('farmaceutico@demo.pe', { method: 'patch', url: `/api/alertas/${alerta.id}/revisar` })).toBe(200)
    const reconocidaEn = alerta.reconocida_en
    await new Promise((r) => setTimeout(r, 5))
    expect(await estado('admin@demo.pe', { method: 'post', url: `/api/alertas/${alerta.id}/acciones-correctivas`, data: ACCION })).toBe(201)

    expect(alerta.revisada_por).toBe('u-01')
    expect(alerta.reconocida_en).toBe(reconocidaEn)
    expect(alerta.atendida_en).not.toBe(reconocidaEn)
  })

  it('sin sesión responde 401', async () => {
    const alerta = nuevaPendiente()
    expect(await estado(null, { method: 'post', url: `/api/alertas/${alerta.id}/acciones-correctivas`, data: ACCION })).toBe(401)
  })
})
