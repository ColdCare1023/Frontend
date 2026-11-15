import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  aClasificacionPreventiva,
  olvidarClasificacionPreventiva,
  useClasificacionPreventiva,
} from '@/application/hooks/useClasificacionPreventiva'
import { useAuthStore } from '@/application/stores/authStore'
import type { Rol } from '@/domain/value-objects/Rol'
import { esperarMicrotasks, instalarAdaptadorFalso } from '../../ayudas'
import { existeRuta } from '../../contrato/validarOpenApi'

function sesion(rol: Rol) {
  useAuthStore.setState({ usuario: { id: 'u-1', email: `${rol}@upc.pe`, rol, expiraEn: Date.now() + 3_600_000 }, autenticado: true })
}

/** HU-20 / HU-34 / HU-46: lo que informa GET /api/ia/preventivo. */
describe('aClasificacionPreventiva', () => {
  it('opera solo con modo activo, modelo cargado y la versión activa del registro', () => {
    const c = aClasificacionPreventiva({
      modo: 'activo', disponible: true, version: 'p-1', motivo_codigo: null,
      version_activa_registrada: 'p-1', es_version_activa_registrada: true,
    })
    expect(c).toMatchObject({ operativa: true, motivo: null, artefactoGobernado: 'preventivo', version: 'p-1', versionActivaRegistrada: 'p-1' })
  })

  it('modo activo sin versión activa registrada: fuera de operación, con su motivo', () => {
    const c = aClasificacionPreventiva({
      modo: 'activo', disponible: false, version: 'p-1', motivo_codigo: 'sin_version_activa_registrada',
      version_activa_registrada: null, es_version_activa_registrada: false,
    })
    expect(c).toMatchObject({ operativa: false, motivo: 'sin_version_activa_registrada', artefactoGobernado: 'preventivo' })
  })

  it('cargado pero sin ser la versión activa del registro no opera', () => {
    expect(aClasificacionPreventiva({ modo: 'activo', disponible: true, es_version_activa_registrada: false }).operativa).toBe(false)
  })

  it('el modo sombra nunca opera, aunque el modelo esté cargado', () => {
    expect(aClasificacionPreventiva({ modo: 'sombra', disponible: true }).operativa).toBe(false)
  })

  it('desactivado (valor por defecto del backend): el artefacto que gobierna el registro es el legado', () => {
    const c = aClasificacionPreventiva({ modo: 'desactivado', disponible: false, motivo_codigo: 'modo_desactivado' })
    expect(c).toMatchObject({ operativa: false, motivo: 'modo_desactivado', artefactoGobernado: 'legado' })
  })

  it('backend anterior (sin motivo_codigo ni registro): deduce solo lo que se sabe', () => {
    expect(aClasificacionPreventiva({ modo: 'desactivado', disponible: false, motivo: 'modo_desactivado' })).toMatchObject({
      motivo: 'modo_desactivado', esVersionActivaRegistrada: null,
    })
    expect(aClasificacionPreventiva({ modo: 'activo', disponible: true })).toMatchObject({ operativa: true, esVersionActivaRegistrada: null })
    expect(aClasificacionPreventiva({ modo: 'activo', disponible: false, motivo: 'x' }).motivo).toBeNull()
  })

  it('un código o modo desconocido no se inventa', () => {
    expect(aClasificacionPreventiva({ modo: 'raro', disponible: true, motivo_codigo: 'otro' })).toMatchObject({ modo: null, operativa: false, motivo: null })
  })
})

describe('useClasificacionPreventiva', () => {
  let adaptador: ReturnType<typeof instalarAdaptadorFalso> | undefined
  beforeEach(() => olvidarClasificacionPreventiva())
  afterEach(() => {
    adaptador?.restaurar()
    useAuthStore.setState({ usuario: null, autenticado: false })
  })

  const OPERATIVA = { modo: 'activo', disponible: true, version: 'p-1', version_activa_registrada: 'p-1', es_version_activa_registrada: true }

  it.each<Rol>(['farmaceutico', 'auditor', 'administrador'])('%s consulta la ruta del backend', async (rol) => {
    sesion(rol)
    adaptador = instalarAdaptadorFalso(() => ({ data: OPERATIVA }))
    const { result } = renderHook(() => useClasificacionPreventiva())
    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect(result.current.operativa).toBe(true)
    expect(adaptador.peticiones).toHaveLength(1)
    expect(adaptador.ultima()).toMatchObject({ method: 'get', url: '/api/ia/preventivo' })
    expect(existeRuta('get', adaptador.ultima().url)).toBe(true)
  })

  it('al técnico no se le consulta (el backend respondería 403 y lo auditaría): no se sabe', async () => {
    sesion('tecnico')
    adaptador = instalarAdaptadorFalso(() => ({ data: OPERATIVA }))
    const { result } = renderHook(() => useClasificacionPreventiva())
    await esperarMicrotasks()
    expect(adaptador.peticiones).toHaveLength(0)
    expect(result.current).toMatchObject({ clasificacion: null, operativa: false, cargando: false })
  })

  it('sin respuesta del backend no la da por operativa', async () => {
    sesion('farmaceutico')
    adaptador = instalarAdaptadorFalso(() => ({ status: 500, data: {} }))
    const { result } = renderHook(() => useClasificacionPreventiva())
    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect(result.current).toMatchObject({ clasificacion: null, operativa: false })
  })

  it('varias piezas de la pantalla comparten una consulta; recargar vuelve a preguntar', async () => {
    sesion('farmaceutico')
    let respuesta: Record<string, unknown> = { modo: 'activo', disponible: false, motivo_codigo: 'sin_version_activa_registrada' }
    adaptador = instalarAdaptadorFalso(() => ({ data: respuesta }))
    const a = renderHook(() => useClasificacionPreventiva())
    const b = renderHook(() => useClasificacionPreventiva())
    await waitFor(() => expect(a.result.current.cargando).toBe(false))
    await waitFor(() => expect(b.result.current.cargando).toBe(false))
    expect(adaptador.peticiones).toHaveLength(1)
    expect(a.result.current.operativa).toBe(false)

    respuesta = OPERATIVA
    await act(async () => {
      await a.result.current.recargar()
    })
    expect(adaptador.peticiones).toHaveLength(2)
    expect(a.result.current.operativa).toBe(true)
  })
})
