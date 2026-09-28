import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'

import { useAuthStore } from '@/application/stores/authStore'
import type { Rol } from '@/domain/value-objects/Rol'
import { GuiaPage } from '@/presentation/pages/GuiaPage'

function sesionCon(rol: Rol) {
  useAuthStore.setState({
    usuario: { id: 'u-1', email: `${rol}@upc.pe`, rol, expiraEn: Date.now() + 3600_000 },
    autenticado: true,
    requierePrivacidad: false,
  })
}

function montar() {
  return render(
    <MemoryRouter>
      <GuiaPage />
    </MemoryRouter>,
  )
}

describe('GuiaPage', () => {
  beforeEach(() => sesionCon('tecnico'))

  it('explica la rutina diaria antes que las pantallas sueltas', () => {
    montar()

    expect(screen.getByText(/la rutina de un día/i)).toBeInTheDocument()
    expect(screen.getByText(/completa el checklist bpa del día/i)).toBeInTheDocument()
  })

  it('traduce el vocabulario técnico a lenguaje de farmacia', () => {
    montar()

    expect(screen.getByText('Excursión crítica')).toBeInTheDocument()
    expect(screen.getByText(/la temperatura salió del rango/i)).toBeInTheDocument()
  })

  it('a un técnico solo le describe las pantallas que puede abrir', () => {
    // Explicar pantallas inaccesibles genera más dudas de las que resuelve.
    sesionCon('tecnico')
    montar()

    expect(screen.getByRole('link', { name: 'Monitoreo' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Checklist BPA' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Usuarios y roles' })).not.toBeInTheDocument()
  })

  it('al farmacéutico le suma las pantallas de cumplimiento', () => {
    sesionCon('farmaceutico')
    montar()

    expect(screen.getByRole('link', { name: 'Checklist BPA' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Reportes BPA' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Usuarios y roles' })).not.toBeInTheDocument()
  })

  it('al administrador le describe también la parte de gestión', () => {
    sesionCon('administrador')
    montar()

    expect(screen.getByRole('link', { name: 'Usuarios y roles' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Bitácora de auditoría' })).toBeInTheDocument()
  })
})
