import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { CampoCodigo, type EstadoCampoCodigo } from '@/presentation/components/ui/campo-codigo'

function Controlado({
  onCompleto = () => {},
  estado = 'normal',
  inicial = '',
}: {
  onCompleto?: (codigo: string) => void
  estado?: EstadoCampoCodigo
  inicial?: string
}) {
  const [valor, setValor] = useState(inicial)
  return (
    <>
      <CampoCodigo etiqueta="Código de verificación" valor={valor} onCambiar={setValor} onCompleto={onCompleto} estado={estado} />
      <output data-testid="valor">{valor}</output>
    </>
  )
}

const casilla = (n: number) => screen.getByLabelText(`Dígito ${n} de 6`)

describe('CampoCodigo', () => {
  it('expone seis casillas numéricas etiquetadas y el autocompletado del sistema', () => {
    render(<Controlado />)
    expect(screen.getByRole('group', { name: 'Código de verificación' })).toBeInTheDocument()
    for (let n = 1; n <= 6; n++) {
      expect(casilla(n)).toHaveAttribute('inputmode', 'numeric')
    }
    expect(casilla(1)).toHaveAttribute('autocomplete', 'one-time-code')
    expect(casilla(2)).toHaveAttribute('autocomplete', 'off')
  })

  it('avanza al escribir, ignora letras y avisa al completar', async () => {
    const onCompleto = vi.fn()
    const user = userEvent.setup()
    render(<Controlado onCompleto={onCompleto} />)

    await user.click(casilla(1))
    await user.keyboard('1a2345')
    expect(screen.getByTestId('valor')).toHaveTextContent('12345')
    expect(casilla(6)).toHaveFocus()
    expect(onCompleto).not.toHaveBeenCalled()

    await user.keyboard('6')
    expect(screen.getByTestId('valor')).toHaveTextContent('123456')
    expect(onCompleto).toHaveBeenCalledWith('123456')
  })

  it('pegar el código completo en cualquier casilla rellena todas', async () => {
    const onCompleto = vi.fn()
    const user = userEvent.setup()
    render(<Controlado onCompleto={onCompleto} />)

    await user.click(casilla(4))
    await user.paste('482 913')
    expect(screen.getByTestId('valor')).toHaveTextContent('482913')
    expect(casilla(1)).toHaveValue('4')
    expect(casilla(6)).toHaveValue('3')
    expect(onCompleto).toHaveBeenCalledWith('482913')
  })

  it('el autocompletado del sistema en la primera casilla reparte los dígitos', async () => {
    const user = userEvent.setup()
    render(<Controlado />)
    await user.click(casilla(1))
    await user.keyboard('987654')
    expect(casilla(6)).toHaveValue('4')
  })

  it('retroceso borra y vuelve a la casilla anterior; las flechas navegan', async () => {
    const user = userEvent.setup()
    render(<Controlado inicial="123" />)

    await user.click(casilla(4))
    await user.keyboard('{Backspace}')
    expect(screen.getByTestId('valor')).toHaveTextContent(/^12$/)
    expect(casilla(3)).toHaveFocus()

    await user.keyboard('{ArrowLeft}')
    expect(casilla(2)).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(casilla(3)).toHaveFocus()
  })

  it('borra aunque el teclado no informe Retroceso (Android: key «Unidentified»)', () => {
    render(<Controlado inicial="123" />)
    // Solo llega el `change` con la casilla vacía, sin keydown reconocible.
    fireEvent.change(casilla(2), { target: { value: '' } })
    expect(screen.getByTestId('valor')).toHaveTextContent(/^13$/)
  })

  it('una letra sobre una casilla llena no borra el dígito', () => {
    render(<Controlado inicial="123" />)
    fireEvent.change(casilla(2), { target: { value: 'a' } })
    expect(screen.getByTestId('valor')).toHaveTextContent(/^123$/)
  })

  it('la primera casilla lleva la ayuda asociada (a dónde llegó el código)', () => {
    render(
      <>
        <p id="ayuda">Enviado a f***@upc.pe</p>
        <CampoCodigo etiqueta="Código" valor="" onCambiar={() => {}} describedBy="ayuda" />
      </>,
    )
    expect(casilla(1)).toHaveAccessibleDescription('Enviado a f***@upc.pe')
    expect(casilla(2)).not.toHaveAttribute('aria-describedby')
  })

  it('marca el error en cada casilla para lectores de pantalla', () => {
    render(<Controlado estado="error" inicial="111111" />)
    expect(casilla(1)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('group')).toHaveAttribute('data-estado', 'error')
  })

  it('refleja la aceptación del código', () => {
    render(<Controlado estado="exito" inicial="123456" />)
    expect(screen.getByRole('group')).toHaveAttribute('data-estado', 'exito')
    expect(casilla(1)).not.toHaveAttribute('aria-invalid')
  })
})
