import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { Inbox } from 'lucide-react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import i18n from '@/infrastructure/i18n'
import { EstadoCarga, EstadoError, EstadoVacio } from '@/presentation/components/EstadoPagina'
import { PageHeader } from '@/presentation/components/PageHeader'
import { BarraFiltros } from '@/presentation/components/ui/barra-filtros'
import { Button } from '@/presentation/components/ui/button'
import { HojaInferior } from '@/presentation/components/ui/hoja-inferior'
import { Indicador, Indicadores } from '@/presentation/components/ui/indicadores'
import { Campo, Input } from '@/presentation/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/presentation/components/ui/table'
import { TituloPagina } from '@/presentation/components/ui/titulo-pagina'

function simularAncho(ancho: number) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (consulta: string) =>
      ({
        matches: Number(/min-width:\s*(\d+)/.exec(consulta)?.[1] ?? 0) <= ancho,
        media: consulta,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }) as unknown as MediaQueryList,
  )
}

beforeEach(async () => {
  await i18n.changeLanguage('es')
})

describe('Button', () => {
  it('«cargando» lo bloquea y lo anuncia', async () => {
    const alPulsar = vi.fn()
    const usuario = userEvent.setup()
    render(<Button cargando onClick={alPulsar}>Guardar</Button>)

    const boton = screen.getByRole('button', { name: 'Guardar' })
    expect(boton).toBeDisabled()
    expect(boton).toHaveAttribute('aria-busy', 'true')
    await usuario.click(boton)
    expect(alPulsar).not.toHaveBeenCalled()
  })

  it('no envía un formulario por accidente', () => {
    render(<Button>Abrir</Button>)
    expect(screen.getByRole('button', { name: 'Abrir' })).toHaveAttribute('type', 'button')
  })
})

describe('Campo', () => {
  it('asocia la etiqueta al control y anuncia el error en lugar de la ayuda', () => {
    render(
      <Campo etiqueta="Correo" htmlFor="correo" ayuda="Tu correo de trabajo" error="El correo no es válido">
        <Input id="correo" />
      </Campo>,
    )

    expect(screen.getByLabelText('Correo')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('El correo no es válido')
    expect(screen.queryByText('Tu correo de trabajo')).toBeNull()
  })
})

describe('Table', () => {
  it('«numero» alinea la cifra en cabecera y celda sin perder la semántica', () => {
    render(
      <Table titulo="Lecturas">
        <TableHeader>
          <TableRow>
            <TableHead numero>Temperatura</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell numero>4.7 °C</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    )

    expect(screen.getByRole('columnheader', { name: 'Temperatura' })).toHaveClass('text-right')
    expect(screen.getByRole('cell', { name: '4.7 °C' })).toHaveClass('nums', 'text-right')
  })
})

describe('TituloPagina', () => {
  it('es el encabezado de la página y deja las acciones a su lado', () => {
    render(<TituloPagina titulo="Historial" descripcion="Lecturas guardadas"><Button>Exportar</Button></TituloPagina>)

    expect(screen.getByRole('heading', { level: 1, name: 'Historial' })).toBeInTheDocument()
    expect(screen.getByText('Lecturas guardadas')).toHaveClass('sr-only')
    expect(screen.getByRole('button', { name: 'Exportar' })).toBeInTheDocument()
  })

  it('PageHeader sigue funcionando con su API de siempre', () => {
    render(<PageHeader titulo="Alertas" eyebrow="Operación" descripcion="Bandeja" />)

    expect(screen.getByRole('heading', { level: 1, name: 'Alertas' })).toBeInTheDocument()
    expect(screen.getByText('Operación')).toHaveClass('sr-only')
  })
})

describe('Indicadores', () => {
  it('es una lista de definición: cada cifra queda ligada a su nombre', () => {
    render(
      <Indicadores>
        <Indicador etiqueta="Fuera de rango" valor={2} tono="critico" detalle="últimas 24 h" />
        <Indicador etiqueta="Temperatura" valor="4.7" unidad="°C" />
      </Indicadores>,
    )

    expect(screen.getAllByRole('term').map((t) => t.textContent)).toEqual(['Fuera de rango', 'Temperatura'])
    const definiciones = screen.getAllByRole('definition')
    expect(definiciones[0]).toHaveTextContent('2')
    expect(definiciones[0]).toHaveTextContent('últimas 24 h')
    expect(definiciones[1]).toHaveTextContent('4.7°C')
  })
})

describe('Estados', () => {
  it('carga y vacío usan `status`; el error interrumpe con `alert`', async () => {
    const reintentar = vi.fn()
    const usuario = userEvent.setup()
    render(
      <>
        <EstadoCarga texto="Cargando lecturas" variant="tabla" />
        <EstadoVacio icono={Inbox} titulo="Sin lecturas" detalle="Prueba otras fechas" />
        <EstadoError mensaje="No se pudo cargar" onReintentar={reintentar} />
      </>,
    )

    const estados = screen.getAllByRole('status')
    expect(estados[0]).toHaveTextContent('Cargando lecturas')
    expect(estados[1]).toHaveTextContent('Sin lecturas')
    const error = screen.getByRole('alert')
    expect(error).toHaveTextContent('No se pudo cargar')

    await usuario.click(within(error).getByRole('button', { name: 'Volver a intentar' }))
    expect(reintentar).toHaveBeenCalledOnce()
  })
})

describe('HojaInferior', () => {
  function Hoja({ ocultarTitulo = false }: { ocultarTitulo?: boolean }) {
    const [abierta, setAbierta] = useState(true)
    return (
      <>
        <button type="button" onClick={() => setAbierta(true)}>Abrir</button>
        <HojaInferior abierta={abierta} onCambiar={setAbierta} titulo="Detalle" ocultarTitulo={ocultarTitulo} descripcion="De la alerta" pie={<Button>Listo</Button>}>
          <Input aria-label="Motivo" />
        </HojaInferior>
      </>
    )
  }

  it('es un diálogo con nombre y descripción', () => {
    render(<Hoja />)
    expect(screen.getByRole('dialog', { name: 'Detalle' })).toHaveAccessibleDescription('De la alerta')
  })

  it('el foco va a la hoja y no al primer campo: no abre el teclado sin que nadie lo pida', () => {
    render(<Hoja />)
    expect(screen.getByRole('dialog')).toHaveFocus()
    expect(screen.getByRole('textbox', { name: 'Motivo' })).not.toHaveFocus()
  })

  it('se cierra con Escape y con su botón', async () => {
    const usuario = userEvent.setup()
    render(<Hoja />)

    await usuario.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()

    await usuario.click(screen.getByRole('button', { name: 'Abrir', hidden: true }))
    await usuario.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('oculto a la vista, el título sigue nombrando al diálogo', () => {
    render(<Hoja ocultarTitulo />)
    expect(screen.getByRole('dialog', { name: 'Detalle' })).toBeInTheDocument()
  })
})

describe('BarraFiltros', () => {
  function Barra({ onQuitar = vi.fn(), onLimpiar = vi.fn() }: { onQuitar?: () => void; onLimpiar?: () => void }) {
    return (
      <BarraFiltros activos={[{ id: 'equipo', etiqueta: 'FARM-01', onQuitar }]} onLimpiar={onLimpiar} acciones={<Button>Exportar</Button>}>
        <Campo etiqueta="Equipo" htmlFor="equipo">
          <Input id="equipo" />
        </Campo>
      </BarraFiltros>
    )
  }

  it('cerrada no ocupa la pantalla: los campos no están en el documento', () => {
    simularAncho(1440)
    render(<Barra />)

    expect(screen.queryByLabelText('Equipo')).toBeNull()
    expect(screen.getByRole('button', { name: 'Filtros, 1 activo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Exportar' })).toBeInTheDocument()
  })

  it('lo elegido queda a la vista y se quita de uno en uno', async () => {
    simularAncho(1440)
    const onQuitar = vi.fn()
    const usuario = userEvent.setup()
    render(<Barra onQuitar={onQuitar} />)

    expect(screen.getByText('FARM-01')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Quitar filtro: FARM-01' }))
    expect(onQuitar).toHaveBeenCalledOnce()
  })

  it('en escritorio se abre en un panel, no en un diálogo modal', async () => {
    simularAncho(1440)
    const onLimpiar = vi.fn()
    const usuario = userEvent.setup()
    render(<Barra onLimpiar={onLimpiar} />)

    await usuario.click(screen.getByRole('button', { name: 'Filtros, 1 activo' }))

    expect(screen.getByLabelText('Equipo')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Limpiar' }))
    expect(onLimpiar).toHaveBeenCalledOnce()
    await usuario.click(screen.getByRole('button', { name: 'Listo' }))
    expect(screen.queryByLabelText('Equipo')).toBeNull()
  })

  it('en móvil se abre en una hoja inferior', async () => {
    simularAncho(402)
    const usuario = userEvent.setup()
    render(<Barra />)

    await usuario.click(screen.getByRole('button', { name: 'Filtros, 1 activo' }))

    const hoja = screen.getByRole('dialog', { name: 'Filtros' })
    expect(within(hoja).getByLabelText('Equipo')).toBeInTheDocument()
    await usuario.click(within(hoja).getByRole('button', { name: 'Listo' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('sin filtros no ofrece limpiar nada', async () => {
    simularAncho(1440)
    const usuario = userEvent.setup()
    render(
      <BarraFiltros onLimpiar={vi.fn()}>
        <Campo etiqueta="Equipo" htmlFor="equipo">
          <Input id="equipo" />
        </Campo>
      </BarraFiltros>,
    )

    await usuario.click(screen.getByRole('button', { name: 'Filtros' }))
    expect(screen.queryByRole('button', { name: 'Limpiar' })).toBeNull()
  })
})
