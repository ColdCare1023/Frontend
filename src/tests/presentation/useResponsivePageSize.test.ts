import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { TAMANO_PAGINA } from '@/lib/paginacion'
import { useResponsivePageSize } from '@/presentation/hooks/useResponsivePageSize'

function simularPantalla(esMovil: boolean) {
  vi.spyOn(window, 'matchMedia').mockReturnValue({
    matches: esMovil,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as MediaQueryList)
}

describe('useResponsivePageSize', () => {
  it('en un teléfono acierta desde el primer render: no pinta la tabla larga para recortarla', () => {
    simularPantalla(true)
    const tamanos: number[] = []
    renderHook(() => {
      const tamano = useResponsivePageSize()
      tamanos.push(tamano)
      return tamano
    })
    expect(tamanos).toEqual([5])
  })

  it('en escritorio conserva la densidad de siempre', () => {
    simularPantalla(false)
    expect(renderHook(() => useResponsivePageSize()).result.current).toBe(TAMANO_PAGINA)
  })
})
