import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { SocialAuthSection } from '@/presentation/components/auth/SocialAuthSection'

describe('SocialAuthSection', () => {
  it('muestra botones oficiales de Google y Facebook con separador accesible', () => {
    render(
      <MemoryRouter>
        <SocialAuthSection onSuccess={vi.fn()} />
      </MemoryRouter>,
    )

    expect(screen.getByText(/o continúa con/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Continuar con Google/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Continuar con Facebook/i })).toBeInTheDocument()
  })

  it('muestra aviso de cuenta no autorizada cuando el usuario federado no tiene rol asignado', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <SocialAuthSection onSuccess={vi.fn()} hintEmail="noautorizado@hospital.org" />
      </MemoryRouter>,
    )

    const botonGoogle = screen.getByRole('button', { name: /Continuar con Google/i })
    await user.click(botonGoogle)

    expect(
      await screen.findByText(/Tu cuenta se autenticó correctamente, pero aún no tiene acceso al sistema/i),
    ).toBeInTheDocument()

    const enlaceSolicitud = screen.getByRole('link', { name: /Solicitar acceso al administrador/i })
    expect(enlaceSolicitud).toBeInTheDocument()
    expect(enlaceSolicitud).toHaveAttribute(
      'href',
      expect.stringContaining('/solicitar-acceso?email=noautorizado%40hospital.org'),
    )
  })

  it('concede acceso cuando la cuenta federada está autorizada en ColdCare', async () => {
    const onSuccess = vi.fn()
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <SocialAuthSection onSuccess={onSuccess} hintEmail="admin@demo.pe" />
      </MemoryRouter>,
    )

    const botonGoogle = screen.getByRole('button', { name: /Continuar con Google/i })
    await user.click(botonGoogle)

    await vi.waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(expect.stringContaining('.demo'))
    })
  })
})
