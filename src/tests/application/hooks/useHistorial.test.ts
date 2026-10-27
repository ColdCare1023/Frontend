import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { useHistorial } from '@/application/hooks/useHistorial'
import { instalarAdaptadorFalso } from '../../ayudas'
import { existeRuta } from '../../contrato/validarOpenApi'

/** HU-36 / B-14: el filtro de riesgo usa el riesgo efectivo, igual que la tabla. */
describe('useHistorial — filtro de riesgo', () => {
  let adaptador: ReturnType<typeof instalarAdaptadorFalso>
  afterEach(() => adaptador?.restaurar())

  it('envía riesgo_efectivo, no nivel_riesgo', async () => {
    adaptador = instalarAdaptadorFalso(() => ({ data: [] }))
    const { result } = renderHook(() => useHistorial())
    await waitFor(() => expect(result.current.cargando).toBe(false))

    await act(async () => {
      await result.current.consultar({ riesgo_efectivo: 'excursion_critica' })
    })

    const peticion = adaptador.peticiones.at(-1)!
    expect(existeRuta('get', peticion.url)).toBe(true)
    expect(peticion.params).toMatchObject({ riesgo_efectivo: 'excursion_critica' })
    expect(peticion.params).not.toHaveProperty('nivel_riesgo')
  })
})
