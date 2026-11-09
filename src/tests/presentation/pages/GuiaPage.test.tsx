import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'

import { useAuthStore } from '@/application/stores/authStore'
import type { Rol } from '@/domain/value-objects/Rol'
import { GuiaPage } from '@/presentation/pages/GuiaPage'

function sesionCon(rol: Rol) {
  useAuthStore.setState({
    usuario: { id: 'u-1', email: `${rol}@upc.pe`, rol, expiraEn: Date.now() + 3600_000 },
    autenticado: true,

  })
}

function montar() {
  return render(
    <MemoryRouter>
      <GuiaPage />
    </MemoryRouter>,
  )
}

function enlaceA(ruta: string, nombre: RegExp) {
  return screen.getAllByRole('link', { name: nombre })
    .find((enlace) => enlace.getAttribute('href') === ruta)
}

describe('GuiaPage', () => {
  beforeEach(() => sesionCon('tecnico'))

  it('explica una rutina común sin recomendar tareas inaccesibles', () => {
    montar()

    expect(screen.getByText(/revisa monitoreo/i)).toBeInTheDocument()
    expect(screen.getByText(/usa historial/i)).toBeInTheDocument()
    expect(screen.queryByText(/completa el checklist/i)).not.toBeInTheDocument()
  })

  it('explica los estados térmicos con lenguaje del dominio', () => {
    montar()

    expect(screen.getAllByText('Excursión crítica').length).toBeGreaterThan(0)
    expect(screen.getByText(/la lectura salió del rango permitido/i)).toBeInTheDocument()
    expect(screen.getByText(/ejemplo ilustrativo/i)).toBeInTheDocument()
  })

  it('a un técnico solo le describe pantallas comunes que puede abrir', () => {
    sesionCon('tecnico')
    montar()

    expect(enlaceA('/dashboard', /Monitoreo/i)).toBeInTheDocument()
    expect(enlaceA('/alertas', /Alertas/i)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /controles de almacenamiento/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /usuarios y roles/i })).not.toBeInTheDocument()
  })

  it('muestra al farmacéutico reportes y resultados del clasificador', () => {
    sesionCon('farmaceutico')
    montar()

    expect(enlaceA('/reportes', /reportes de monitoreo/i)).toBeInTheDocument()
    expect(enlaceA('/metricas-ia', /cómo se comporta el clasificador/i)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /usuarios y roles/i })).not.toBeInTheDocument()
  })

  it('muestra al auditor todas sus rutas de solo lectura', () => {
    sesionCon('auditor')
    montar()

    expect(enlaceA('/dashboard', /monitoreo/i)).toBeInTheDocument()
    expect(enlaceA('/reportes', /reportes de monitoreo/i)).toBeInTheDocument()
    expect(enlaceA('/metricas-ia', /cómo se comporta el clasificador/i)).toBeInTheDocument()
    expect(enlaceA('/auditoria', /bitácora de auditoría/i)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /controles de almacenamiento/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /usuarios y roles/i })).not.toBeInTheDocument()
  })

  it('administra todas las secciones disponibles para el rol administrador', () => {
    sesionCon('administrador')
    montar()

    expect(enlaceA('/usuarios', /usuarios y roles/i)).toBeInTheDocument()
    expect(enlaceA('/auditoria', /bitácora de auditoría/i)).toBeInTheDocument()
  })

  it('ofrece navegación local a las secciones largas de la guía', () => {
    montar()

    const nav = screen.getByRole('navigation', { name: /secciones de la guía/i })
    expect(within(nav).getByRole('link', { name: /responder a una alerta/i })).toHaveAttribute('href', '#guia-alerta-titulo')
  })
})
