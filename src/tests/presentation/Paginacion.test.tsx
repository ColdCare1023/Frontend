import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { rangoPagina, totalPaginas } from '@/lib/paginacion'
import { Paginacion } from '@/presentation/components/Paginacion'

describe('rangoPagina / totalPaginas', () => {
  it('corta la lista en bloques del tamaño de página', () => {
    expect(rangoPagina(1, 15)).toEqual([0, 15])
    expect(rangoPagina(3, 15)).toEqual([30, 45])
  })

  it('una lista vacía sigue siendo una página', () => {
    // Devolver 0 haría que los controles calcularan "página 1 de 0".
    expect(totalPaginas(0, 15)).toBe(1)
  })

  it('no deja elementos fuera cuando la última página está incompleta', () => {
    expect(totalPaginas(31, 15)).toBe(3)
  })
})

describe('Paginacion', () => {
  it('resume qué tramo se está viendo', () => {
    render(<Paginacion total={200} pagina={2} onCambiar={vi.fn()} />)

    expect(screen.getByText('Mostrando 16–30 de 200')).toBeInTheDocument()
  })

  it('deshabilita el retroceso en la primera página y el avance en la última', () => {
    const { unmount } = render(<Paginacion total={40} pagina={1} onCambiar={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled()
    unmount()

    render(<Paginacion total={40} pagina={3} onCambiar={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Página siguiente' })).toBeDisabled()
  })

  it('avisa del cambio al pulsar un número', async () => {
    const alCambiar = vi.fn()
    render(<Paginacion total={200} pagina={1} onCambiar={alCambiar} />)

    await userEvent.click(screen.getByRole('button', { name: '2' }))

    expect(alCambiar).toHaveBeenCalledWith(2)
  })

  it('resume con elipsis en vez de pintar un botón por página', () => {
    // Con 200 registros hay 14 páginas; sin la ventana, la barra tendría 14
    // botones y con 5000 registros sería impracticable.
    render(<Paginacion total={200} pagina={7} onCambiar={vi.fn()} />)

    const numeros = screen
      .getAllByRole('button')
      .map((b) => b.textContent?.trim())
      .filter((t) => t && /^\d+$/.test(t))
    expect(numeros).toEqual(['1', '6', '7', '8', '14'])
  })

  it('rescata al usuario si el filtro deja menos páginas de las que había', () => {
    // Al filtrar, quien estuviera en la página 7 se quedaría mirando una tabla
    // vacía sin entender por qué.
    const alCambiar = vi.fn()
    render(<Paginacion total={20} pagina={7} onCambiar={alCambiar} />)

    expect(alCambiar).toHaveBeenCalledWith(2)
  })

  it('no muestra controles cuando todo cabe en una página', () => {
    render(<Paginacion total={8} pagina={1} onCambiar={vi.fn()} />)

    expect(screen.queryByRole('button', { name: 'Página siguiente' })).not.toBeInTheDocument()
    expect(screen.getByText(/8 registro/)).toBeInTheDocument()
  })
})
