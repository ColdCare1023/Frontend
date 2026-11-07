import { useState } from 'react'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import i18n from '@/infrastructure/i18n'
import { SelectorFecha } from '@/presentation/components/ui/selector-fecha'

function Campo({ inicial, conHora = false, alCambiar }: { inicial: string; conHora?: boolean; alCambiar?: (valor: string) => void }) {
  const [valor, setValor] = useState(inicial)
  return (
    <SelectorFecha
      id="fecha"
      valor={valor}
      conHora={conHora}
      onCambiar={(nuevo) => {
        setValor(nuevo)
        alCambiar?.(nuevo)
      }}
    />
  )
}

beforeEach(async () => {
  await i18n.changeLanguage('es')
})

describe('SelectorFecha', () => {
  it('muestra el valor ISO con el formato del idioma', async () => {
    const { unmount } = render(<Campo inicial="2026-11-07" />)
    expect(screen.getByRole('textbox')).toHaveValue('07/11/2026')
    unmount()

    render(<Campo inicial="2026-11-07T08:30" conHora />)
    expect(screen.getByRole('textbox')).toHaveValue('07/11/2026 08:30')

    await act(async () => {
      await i18n.changeLanguage('en')
    })
    expect(screen.getByRole('textbox')).toHaveValue('11/07/2026 08:30')
  })

  it('al escribir solo acepta fechas completas y que existen', async () => {
    const usuario = userEvent.setup()
    const alCambiar = vi.fn()
    render(<Campo inicial="" alCambiar={alCambiar} />)
    const campo = screen.getByRole('textbox')

    await usuario.type(campo, '31/02/2026')
    expect(alCambiar).not.toHaveBeenCalled()

    await usuario.clear(campo)
    await usuario.type(campo, '15/03/2026')
    expect(alCambiar).toHaveBeenLastCalledWith('2026-03-15')

    await usuario.clear(campo)
    await usuario.type(campo, '2026-04-01')
    expect(alCambiar).toHaveBeenLastCalledWith('2026-04-01')
  })

  it('con hora, lee y emite fecha y hora', async () => {
    const usuario = userEvent.setup()
    const alCambiar = vi.fn()
    render(<Campo inicial="" conHora alCambiar={alCambiar} />)

    await usuario.type(screen.getByRole('textbox'), '07/11/2026 25:00')
    expect(alCambiar).not.toHaveBeenCalled()
    await usuario.clear(screen.getByRole('textbox'))
    await usuario.type(screen.getByRole('textbox'), '07/11/2026 23:30')
    expect(alCambiar).toHaveBeenLastCalledWith('2026-11-07T23:30')
  })

  it('el calendario llega al abrirlo y elegir un día cambia el valor', async () => {
    const usuario = userEvent.setup()
    const alCambiar = vi.fn()
    render(<Campo inicial="2026-11-07" alCambiar={alCambiar} />)

    await usuario.click(screen.getByRole('button', { name: 'Abrir calendario' }))
    await screen.findByRole('grid', {}, { timeout: 5000 })
    await usuario.click(screen.getByRole('button', { name: /12 de noviembre/i }))

    expect(alCambiar).toHaveBeenLastCalledWith('2026-11-12')
    expect(screen.getByRole('textbox')).toHaveValue('12/11/2026')
  })
})
