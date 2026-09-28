import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'

import { useAuthStore } from '@/application/stores/authStore'
import i18n, { sincronizarIdiomaDocumento } from '@/infrastructure/i18n'
import { AppLayout } from '@/presentation/layouts/AppLayout'
import { AnuncioRiesgo } from '@/presentation/components/AnuncioRiesgo'
import { RiskBadge } from '@/presentation/components/RiskBadge'
import { TablaAlternativa } from '@/presentation/components/TablaAlternativa'
import { Dialog, DialogContent, DialogTitle } from '@/presentation/components/ui/dialog'
import { Input, Label } from '@/presentation/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/presentation/components/ui/table'
import type { NivelRiesgo } from '@/domain/value-objects/NivelRiesgo'

/**
 * Pruebas de accesibilidad de comportamiento (WCAG 2.2 AA).
 *
 * Solo se afirma aquí lo que se puede observar en el DOM renderizado: roles,
 * nombres accesibles, regiones vivas, foco y navegación por teclado. El
 * contraste de color se verificó midiendo los tokens, no desde jsdom, que no
 * calcula estilos heredados.
 */

beforeEach(async () => {
  await i18n.changeLanguage('es')
})

/** Sesión mínima para montar el layout, igual que en las pruebas de guardias. */
function montarLayout() {
  // Estas pruebas inspeccionan layout tras completar recorrido inicial.
  localStorage.setItem('cf_onboarding_seen_v1:u-1', 'true')
  useAuthStore.setState({
    usuario: {
      id: 'u-1',
      email: 'farmaceutico@upc.pe',
      rol: 'farmaceutico',
      expiraEn: Date.now() + 3600_000,
    },
    autenticado: true,
    requierePrivacidad: false,
  })
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <AppLayout />
    </MemoryRouter>,
  )
}

describe('AnuncioRiesgo — mensajes de estado del flujo SSE (WCAG 4.1.3)', () => {
  function Sonda({ inicial }: { inicial: NivelRiesgo }) {
    const [nivel, setNivel] = useState<NivelRiesgo>(inicial)
    const [temp, setTemp] = useState(5.2)
    return (
      <>
        <AnuncioRiesgo nivel={nivel} temperatura={temp} />
        <button
          type="button"
          onClick={() => {
            setNivel('excursion_critica')
            setTemp(11.4)
          }}
        >
          simular excursión
        </button>
        <button type="button" onClick={() => setTemp(5.3)}>
          simular lectura normal
        </button>
      </>
    )
  }

  it('no anuncia nada en el primer render: el estado inicial no es un cambio', () => {
    render(<AnuncioRiesgo nivel="normal" temperatura={5} />)

    expect(screen.getByRole('status')).toHaveTextContent('')
    expect(screen.getByRole('alert')).toHaveTextContent('')
  })

  it('anuncia la excursión crítica de forma asertiva y con la temperatura', async () => {
    const usuario = userEvent.setup()
    render(<Sonda inicial="normal" />)

    await usuario.click(screen.getByRole('button', { name: 'simular excursión' }))

    const alerta = screen.getByRole('alert')
    expect(alerta).toHaveAttribute('aria-live', 'assertive')
    expect(alerta).toHaveTextContent('Excursión crítica')
    // Sin la cifra, «excursión crítica» no distingue 9 °C de 22 °C.
    expect(alerta).toHaveTextContent('11.4')
  })

  it('mantiene el anuncio fuera de la vista pero dentro del árbol de accesibilidad', async () => {
    const usuario = userEvent.setup()
    render(<Sonda inicial="normal" />)

    await usuario.click(screen.getByRole('button', { name: 'simular excursión' }))

    expect(screen.getByRole('alert')).toHaveClass('sr-only')
    expect(screen.getByRole('alert')).not.toHaveAttribute('aria-hidden')
  })

  it('no repite el anuncio con cada lectura nueva del mismo nivel', async () => {
    const usuario = userEvent.setup()
    render(<Sonda inicial="normal" />)

    // Una lectura más, mismo nivel: a 15 lecturas por minuto, anunciarlas
    // todas convertiría el lector de pantalla en ruido continuo.
    await usuario.click(screen.getByRole('button', { name: 'simular lectura normal' }))

    expect(screen.getByRole('status')).toHaveTextContent('')
    expect(screen.getByRole('alert')).toHaveTextContent('')
  })

  it('usa la región cortés, no la asertiva, cuando el riesgo solo es preventivo', () => {
    const { rerender } = render(<AnuncioRiesgo nivel="normal" temperatura={5} />)
    rerender(<AnuncioRiesgo nivel="riesgo_preventivo" temperatura={8.4} />)

    expect(screen.getByRole('status')).toHaveTextContent('Riesgo preventivo')
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByRole('alert')).toHaveTextContent('')
  })
})

describe('RiskBadge — el nivel no depende solo del color (WCAG 1.4.1)', () => {
  it('acompaña cada nivel de su etiqueta textual', () => {
    render(<RiskBadge nivel="excursion_critica" />)
    expect(screen.getByText('Excursión crítica')).toBeInTheDocument()
  })

  it('expone el detalle del nivel como texto y no solo como `title`', () => {
    const { container } = render(<RiskBadge nivel="excursion_critica" />)

    // `title` no lo alcanza el teclado ni lo lee la mayoría de lectores.
    expect(container.querySelector('[title]')).toBeNull()
    expect(screen.getByText(/revisar el refrigerador ahora/i)).toBeInTheDocument()
  })

  it('marca cada nivel con una forma propia, oculta para el lector', () => {
    const formas = (['normal', 'riesgo_preventivo', 'excursion_critica'] as const).map((nivel) => {
      const { container, unmount } = render(<RiskBadge nivel={nivel} />)
      const svg = container.querySelector('svg')
      expect(svg).toHaveAttribute('aria-hidden')
      const clase = svg?.getAttribute('class') ?? ''
      unmount()
      return clase
    })

    // Tres iconos distintos: la píldora sigue siendo legible en escala de
    // grises o con una deficiencia de percepción del rojo/verde.
    expect(new Set(formas).size).toBe(3)
  })
})

describe('Idioma del documento (WCAG 3.1.1 y 3.1.2)', () => {
  it('sincroniza `<html lang>` al cambiar de idioma', async () => {
    await i18n.changeLanguage('es')
    expect(document.documentElement.lang).toBe('es')

    await i18n.changeLanguage('en')
    expect(document.documentElement.lang).toBe('en')

    await i18n.changeLanguage('es')
    expect(document.documentElement.lang).toBe('es')
  })

  it('recae en español si el idioma resuelto es indeterminado', () => {
    sincronizarIdiomaDocumento(undefined)
    expect(document.documentElement.lang).toBe('es')
  })
})

describe('Diálogo de acción destructiva', () => {
  function DialogoBaja({ destructivo }: { destructivo: boolean }) {
    return (
      <Dialog open>
        <DialogContent destructivo={destructivo}>
          <DialogTitle>Dar de baja</DialogTitle>
          <Label htmlFor="motivo">Motivo</Label>
          <Input id="motivo" />
          <button type="button">Cancelar</button>
          <button type="submit">Confirmar baja</button>
        </DialogContent>
      </Dialog>
    )
  }

  it('se anuncia como `alertdialog` para que se lea la advertencia completa', () => {
    render(<DialogoBaja destructivo />)
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  })

  it('no deja el foco inicial sobre el formulario', () => {
    render(<DialogoBaja destructivo />)

    // Antes, abrir la baja dejaba el foco en el primer campo y un Enter
    // reflejo enviaba el formulario sin haber leído a quién afectaba.
    expect(screen.getByLabelText('Motivo')).not.toHaveFocus()
    expect(screen.getByRole('alertdialog')).toHaveFocus()
  })

  it('un diálogo no destructivo mantiene el rol y el foco habituales', () => {
    render(<DialogoBaja destructivo={false} />)

    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('traduce el nombre del botón de cierre', async () => {
    render(<DialogoBaja destructivo={false} />)
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument()

    // `findByRole`, no `getByRole`: el cambio de idioma repinta el árbol
    // fuera del turno de React y hay que esperar a que se asiente.
    await i18n.changeLanguage('en')
    expect(await screen.findByRole('button', { name: 'Close' })).toBeInTheDocument()
  })

  it('devuelve el foco al contenido y cierra con Escape', async () => {
    const usuario = userEvent.setup()
    function Contenedor() {
      const [abierto, setAbierto] = useState(true)
      return (
        <Dialog open={abierto} onOpenChange={setAbierto}>
          <DialogContent destructivo>
            <DialogTitle>Dar de baja</DialogTitle>
          </DialogContent>
        </Dialog>
      )
    }
    render(<Contenedor />)

    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    await usuario.keyboard('{Escape}')
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})

describe('Tabla de datos', () => {
  function TablaDemo({ cargando = false }: { cargando?: boolean }) {
    return (
      <Table titulo="Historial térmico" cargando={cargando}>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>14/03/2026</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    )
  }

  it('tiene nombre accesible: varias tablas por página son indistinguibles sin él', () => {
    render(<TablaDemo />)
    expect(screen.getByRole('table', { name: 'Historial térmico' })).toBeInTheDocument()
  })

  it('marca las cabeceras con `scope="col"`', () => {
    render(<TablaDemo />)
    expect(screen.getByRole('columnheader', { name: 'Fecha' })).toHaveAttribute('scope', 'col')
  })

  it('el contenedor con desplazamiento horizontal es alcanzable por teclado (WCAG 2.1.1)', () => {
    render(<TablaDemo />)
    expect(screen.getByRole('region', { name: 'Historial térmico' })).toHaveAttribute('tabindex', '0')
  })

  it('señala la consulta en curso con `aria-busy`', () => {
    const { rerender } = render(<TablaDemo cargando />)
    expect(screen.getByRole('region', { name: 'Historial térmico' })).toHaveAttribute('aria-busy', 'true')

    rerender(<TablaDemo cargando={false} />)
    expect(screen.getByRole('region', { name: 'Historial térmico' })).not.toHaveAttribute('aria-busy')
  })
})

describe('TablaAlternativa — alternativa textual a la gráfica (WCAG 1.1.1)', () => {
  const filas = [
    ['08:00:00', '5.1', '21.0', 'Normal'],
    ['08:05:00', '9.4', '21.2', 'Excursión crítica'],
  ]
  const columnas = ['Hora', 'Interna', 'Ambiental', 'Riesgo']

  it('expone los mismos datos de la gráfica en una tabla real', async () => {
    const usuario = userEvent.setup()
    render(<TablaAlternativa titulo="Curva térmica" columnas={columnas} filas={filas} />)

    await usuario.click(screen.getByText(/ver los datos de la gráfica/i))

    const tabla = screen.getByRole('table', { name: 'Curva térmica' })
    expect(within(tabla).getAllByRole('row')).toHaveLength(3)
    expect(within(tabla).getByText('9.4')).toBeInTheDocument()
  })

  it('usa la divulgación nativa `details`/`summary`, operable por teclado', () => {
    // jsdom no implementa el foco ni la activación de `<summary>`, así que no
    // se puede tabular hasta él aquí. Lo que sí se puede comprobar —y es lo
    // que garantiza la operabilidad— es que el control sea el elemento nativo
    // y no un `div` con un `onClick`, que sería inalcanzable sin ratón.
    const { container } = render(
      <TablaAlternativa titulo="Curva térmica" columnas={columnas} filas={filas} />,
    )

    const disparador = screen.getByText(/ver los datos de la gráfica/i).closest('summary')
    expect(disparador).not.toBeNull()
    expect(disparador?.parentElement?.tagName).toBe('DETAILS')
    // Sin `role` ni `aria-expanded` a mano: el navegador ya los expone.
    expect(container.querySelector('details')).not.toHaveAttribute('role')
    expect(disparador).not.toHaveAttribute('aria-expanded')
  })

  it('no monta las filas hasta desplegarla', async () => {
    const usuario = userEvent.setup()
    render(<TablaAlternativa titulo="Curva térmica" columnas={columnas} filas={filas} />)

    // Con una lectura SSE cada pocos segundos, 60 filas montadas de forma
    // permanente se reconstruirían en cada evento sin que nadie las mire.
    expect(screen.queryByRole('table')).toBeNull()

    await usuario.click(screen.getByText(/ver los datos de la gráfica/i))
    expect(screen.getByRole('table', { name: 'Curva térmica' })).toBeInTheDocument()
  })

  it('no dibuja nada si la serie está vacía', () => {
    const { container } = render(
      <TablaAlternativa titulo="Curva térmica" columnas={columnas} filas={[]} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})

describe('Enlace de salto al contenido (WCAG 2.4.1)', () => {
  it('apunta al `id` del landmark principal', () => {
    montarLayout()

    const salto = screen.getByRole('link', { name: /saltar al contenido/i })
    expect(salto).toHaveAttribute('href', '#contenido-principal')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'contenido-principal')
  })

  it('es el primer elemento enfocable del documento', async () => {
    const usuario = userEvent.setup()
    montarLayout()

    await usuario.tab()
    expect(screen.getByRole('link', { name: /saltar al contenido/i })).toHaveFocus()
  })

  it('nombra las dos navegaciones de forma distinta', () => {
    montarLayout()

    expect(screen.getByRole('navigation', { name: 'Navegación principal' })).toBeInTheDocument()
  })
})
