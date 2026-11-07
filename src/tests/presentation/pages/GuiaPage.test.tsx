import { fireEvent, render, screen } from '@testing-library/react'
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

function abrirPregunta(nombre: string) {
  fireEvent.click(screen.getByRole('button', { name: nombre }))
}

function enlaceA(ruta: string, nombre: RegExp) {
  return screen.getAllByRole('link', { name: nombre })
    .find((enlace) => enlace.getAttribute('href') === ruta)
}

describe('GuiaPage', () => {
  beforeEach(() => sesionCon('tecnico'))

  it('pregunta «¿Qué necesitas?» y ya trae abierto qué hacer ante una alerta', () => {
    montar()

    expect(screen.getByRole('heading', { level: 1, name: '¿Qué necesitas?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Una alerta sonó, ¿qué hago?' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/sigue el procedimiento de tu farmacia y anota lo que hiciste/i)).toBeInTheDocument()
    expect(screen.getByText(/no confirma que un medicamento se dañó/i)).toBeInTheDocument()
    expect(enlaceA('/alertas', /^ir a alertas/i)).toBeInTheDocument()
  })

  it('cada pregunta abre su respuesta corta y su enlace directo; una a la vez', () => {
    montar()
    abrirPregunta('¿Qué pasó anoche?')

    expect(screen.getByRole('button', { name: '¿Qué pasó anoche?' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Una alerta sonó, ¿qué hago?' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText(/abre historial y elige la fecha/i)).toBeInTheDocument()
    expect(enlaceA('/historial', /^ir a historial/i)).toBeInTheDocument()

    // Tocar la abierta la cierra.
    abrirPregunta('¿Qué pasó anoche?')
    expect(screen.getByRole('button', { name: '¿Qué pasó anoche?' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('a un técnico no le pregunta por lo que no puede abrir', () => {
    montar()

    expect(screen.getByRole('button', { name: '¿Cómo sé si todo está bien?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '¿Alguien cambió mis registros?' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /constancia/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /quién hizo qué/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /registro un equipo/i })).toBeNull()
  })

  it('al farmacéutico le dice cómo sacar una constancia y lo lleva a Reportes', () => {
    sesionCon('farmaceutico')
    montar()
    abrirPregunta('¿Cómo saco una constancia?')

    expect(screen.getByText(/descarga la hoja en pdf/i)).toBeInTheDocument()
    expect(enlaceA('/reportes', /^ir a reportes/i)).toBeInTheDocument()
  })

  it('al administrador le suma registrar equipos y dar acceso', () => {
    sesionCon('administrador')
    montar()

    abrirPregunta('¿Cómo registro un equipo nuevo?')
    expect(screen.getByText(/se muestra una sola vez/i)).toBeInTheDocument()
    expect(enlaceA('/dispositivos', /^ir a equipos/i)).toBeInTheDocument()
    abrirPregunta('¿Cómo le doy acceso a alguien?')
    expect(enlaceA('/usuarios', /^ir a usuarios/i)).toBeInTheDocument()
  })

  it('explica los estados térmicos con lenguaje del dominio', () => {
    montar()
    abrirPregunta('¿Cómo sé si todo está bien?')

    expect(screen.getAllByText('Excursión crítica').length).toBeGreaterThan(0)
    expect(screen.getByText(/^fuera del rango\. revisa/i)).toBeInTheDocument()
    expect(screen.getByText(/ejemplo ilustrativo/i)).toBeInTheDocument()
  })

  it('a un técnico solo le describe pantallas comunes que puede abrir', () => {
    sesionCon('tecnico')
    montar()

    expect(enlaceA('/dashboard', /Inicio/i)).toBeInTheDocument()
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

    expect(enlaceA('/dashboard', /inicio/i)).toBeInTheDocument()
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

  it('lo demás queda a un clic: todas las pantallas, otras dudas y palabras útiles', () => {
    montar()

    expect(screen.getByRole('button', { name: 'Ver todas las pantallas y otras dudas' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('heading', { name: 'Encuentra una pantalla' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Dudas frecuentes' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Palabras útiles' })).toBeInTheDocument()
  })

  it('al elegir un estado se queda en él, y las escenas se declaran de ejemplo', () => {
    montar()
    // La escena del aviso lleva una etiqueta por capa, con la tinta de cada color.
    expect(screen.getAllByText('Ejemplo').length).toBe(2)

    abrirPregunta('¿Cómo sé si todo está bien?')
    expect(screen.getAllByText('Ejemplo').length).toBe(1)
    const critico = screen.getByRole('button', { name: 'Excursión crítica' })
    fireEvent.click(critico)

    expect(critico).toHaveAttribute('aria-pressed', 'true')
    expect(document.querySelector('.estados__campo')).toHaveAttribute('data-tono', 'critico')
  })

  it('las animaciones se pueden pausar', () => {
    montar()
    const pausa = screen.getByRole('button', { name: /pausar animaciones/i })
    expect(pausa).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(pausa)

    expect(pausa).toHaveAttribute('aria-pressed', 'true')
    expect(document.querySelector('.guia')).toHaveAttribute('data-pausado')
  })
})
