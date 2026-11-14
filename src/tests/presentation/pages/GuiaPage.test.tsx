import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

function montar(ruta = '/guia') {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
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
    montar('/guia?paso=pantallas')

    expect(enlaceA('/dashboard', /Monitoreo/i)).toBeInTheDocument()
    expect(enlaceA('/alertas', /Alertas/i)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /controles de almacenamiento/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /usuarios y roles/i })).not.toBeInTheDocument()
  })

  it('muestra al farmacéutico reportes y resultados del clasificador', () => {
    sesionCon('farmaceutico')
    montar('/guia?paso=pantallas')

    expect(enlaceA('/reportes', /reportes de monitoreo/i)).toBeInTheDocument()
    expect(enlaceA('/metricas-ia', /cómo se comporta el clasificador/i)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /usuarios y roles/i })).not.toBeInTheDocument()
  })

  it('muestra al auditor todas sus rutas de solo lectura', () => {
    sesionCon('auditor')
    montar('/guia?paso=pantallas')

    expect(enlaceA('/dashboard', /monitoreo/i)).toBeInTheDocument()
    expect(enlaceA('/reportes', /reportes de monitoreo/i)).toBeInTheDocument()
    expect(enlaceA('/metricas-ia', /cómo se comporta el clasificador/i)).toBeInTheDocument()
    expect(enlaceA('/auditoria', /bitácora de auditoría/i)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /controles de almacenamiento/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /usuarios y roles/i })).not.toBeInTheDocument()
  })

  it('administra todas las secciones disponibles para el rol administrador', () => {
    sesionCon('administrador')
    montar('/guia?paso=pantallas')

    expect(enlaceA('/usuarios', /usuarios y roles/i)).toBeInTheDocument()
    expect(enlaceA('/auditoria', /bitácora de auditoría/i)).toBeInTheDocument()
  })

  it('ofrece la guía como pasos navegables (tablist)', async () => {
    montar()
    const user = userEvent.setup()

    const pasos = screen.getByRole('tablist', { name: /pasos de la guía/i })
    await user.click(within(pasos).getByRole('tab', { name: /responder a una alerta/i }))
    expect(screen.getByRole('tabpanel')).toHaveTextContent(/revisa la lectura/i)
  })

  it('sincroniza el paso con ?paso= y acepta anclajes antiguos', () => {
    const { unmount } = montar('/guia?paso=estados')
    expect(screen.getByRole('tab', { name: /temperatura y estados/i })).toHaveAttribute('aria-selected', 'true')
    unmount()
    montar('/guia#guia-alerta-titulo')
    expect(screen.getByRole('tab', { name: /responder a una alerta/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('las flechas mueven entre pasos y Inicio/Fin van a los extremos', async () => {
    montar()
    const user = userEvent.setup()
    const primero = screen.getByRole('tab', { name: /empezar/i })
    primero.focus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('tab', { name: /temperatura y estados/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /temperatura y estados/i })).toHaveFocus()
    await user.keyboard('{End}')
    expect(screen.getByRole('tab', { name: /palabras útiles/i })).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{Home}')
    expect(primero).toHaveAttribute('aria-selected', 'true')
    expect(primero).toHaveAttribute('tabindex', '0')
  })

  it('«Siguiente» lleva el foco al título del paso nuevo', async () => {
    montar()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /siguiente: temperatura y estados/i }))
    expect(screen.getByRole('heading', { name: /lee la temperatura y su estado/i })).toHaveFocus()
  })

  it('explica «Sin datos» como un estado distinto de la excursión', () => {
    montar('/guia?paso=estados')
    const panel = screen.getByRole('tabpanel')
    expect(within(panel).getByText('Sin datos')).toBeInTheDocument()
    expect(within(panel).getByText(/no es una excursión/i)).toBeInTheDocument()
  })

  it('el paso 1 enlaza a Monitoreo, Alertas e Historial para cualquier rol', () => {
    sesionCon('auditor')
    montar()
    const panel = screen.getByRole('tabpanel')
    expect(within(panel).getByRole('link', { name: /abrir monitoreo/i })).toHaveAttribute('href', '/dashboard')
    expect(within(panel).getByRole('link', { name: /abrir alertas/i })).toHaveAttribute('href', '/alertas')
    expect(within(panel).getByRole('link', { name: /abrir historial/i })).toHaveAttribute('href', '/historial')
  })
})
