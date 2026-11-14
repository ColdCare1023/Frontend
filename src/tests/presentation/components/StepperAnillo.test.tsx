import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Anillo } from '@/presentation/components/ui/anillo'
import { StepperEstatico } from '@/presentation/components/ui/stepper'

describe('StepperEstatico', () => {
  it('es una lista ordenada con el paso actual marcado', () => {
    render(
      <StepperEstatico
        pasos={[
          { id: 'a', titulo: 'Correo enviado', estado: 'hecho' },
          { id: 'b', titulo: 'Escribe el código', estado: 'actual' },
          { id: 'c', titulo: 'Elige su contraseña', estado: 'pendiente' },
        ]}
      />,
    )
    const lista = screen.getByRole('list')
    expect(lista.tagName).toBe('OL')
    expect(screen.getByText('Escribe el código').closest('li')).toHaveAttribute('aria-current', 'step')
    expect(screen.getByText('Correo enviado').closest('li')).not.toHaveAttribute('aria-current')
  })
})

describe('Anillo', () => {
  it('el arco refleja el valor y marca el umbral', () => {
    const { container } = render(<Anillo valor={0.5} umbral={0.85} tono="sin-verificar" tamano={120} grosor={8} animar={false} />)
    const arco = container.querySelector('[data-arco]')!
    const c = Number(arco.getAttribute('stroke-dasharray'))
    expect(Number(arco.getAttribute('stroke-dashoffset'))).toBeCloseTo(c * 0.5)
    expect(container.querySelector('[data-umbral]')).not.toBeNull()
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(container.firstChild).toHaveAttribute('data-tono', 'sin-verificar')
  })
})
