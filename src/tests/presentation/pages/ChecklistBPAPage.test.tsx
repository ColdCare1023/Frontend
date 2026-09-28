import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ITEMS_CHECKLIST_BPA } from '@/domain/entities/ChecklistBPA'
import { fechaISOlocal } from '@/lib/formato'
import { ChecklistBPAPage } from '@/presentation/pages/ChecklistBPAPage'
import { instalarAdaptadorFalso } from '../../ayudas'

/** Respuesta del backend equivalente a un checklist ya guardado. */
function checklistGuardado(marcados: string[], observaciones: string | null = null) {
  const items = Object.fromEntries(ITEMS_CHECKLIST_BPA.map((i) => [i, marcados.includes(i)]))
  return {
    id: 'c-1',
    usuario_id: 'u-1',
    fecha: '2026-07-25',
    observaciones,
    total_conformes: marcados.length,
    conforme: marcados.length === ITEMS_CHECKLIST_BPA.length,
    created_at: '2026-07-25T09:00:00Z',
    updated_at: '2026-07-25T09:00:00Z',
    ...items,
  }
}

describe('ChecklistBPAPage (HU-37)', () => {
  let adaptador: ReturnType<typeof instalarAdaptadorFalso>

  beforeEach(() => {
    adaptador = instalarAdaptadorFalso(() => ({ data: null }))
  })

  afterEach(() => {
    adaptador.restaurar()
  })

  it('renderiza los diez ítems del Manual de BPA (RM N.º 132-2015/MINSA)', async () => {
    render(<ChecklistBPAPage />)

    const items = await screen.findAllByRole('button', { pressed: false })
    // Los diez ítems más ningún otro botón alternable en la página.
    expect(items).toHaveLength(ITEMS_CHECKLIST_BPA.length)
    expect(screen.getByText(/rango 2–8 °C/)).toBeInTheDocument()
    expect(screen.getByText(/plan de contingencia/i)).toBeInTheDocument()
  })

  it('parte de "sin registrar" cuando el backend devuelve null', async () => {
    render(<ChecklistBPAPage />)

    expect(await screen.findByText(/0 de 10 verificados/i)).toBeInTheDocument()
  })

  it('rehidrata el estado exacto guardado en el backend', async () => {
    // Sin esto, corregir un solo ítem obligaría a volver a marcar los diez y la
    // declaración del día se perdería al recargar.
    adaptador.restaurar()
    adaptador = instalarAdaptadorFalso(() => ({
      data: checklistGuardado(['temperatura', 'termometro'], 'Escarcha en el evaporador'),
    }))

    render(<ChecklistBPAPage />)

    await waitFor(() => expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(2))
    expect(screen.getByLabelText(/observaciones/i)).toHaveValue('Escarcha en el evaporador')
    // Texto exacto: el aviso de no conformidad repite la expresión «con
    // observaciones», y una expresión regular casaría con los dos.
    expect(screen.getByText('Con observaciones')).toBeInTheDocument()
  })

  it('marcar un ítem actualiza el progreso', async () => {
    const usuario = userEvent.setup()
    render(<ChecklistBPAPage />)
    const items = await screen.findAllByRole('button', { pressed: false })

    await usuario.click(items[0])

    expect(await screen.findByText(/1 de 10 verificados/i)).toBeInTheDocument()
  })

  it('REGRESIÓN: se puede guardar una verificación con no conformidades', async () => {
    // Defecto real: el botón estaba deshabilitado hasta marcar los diez ítems,
    // de modo que un farmacéutico que encontrara una no conformidad —el hallazgo
    // que precisamente hay que dejar registrado— no podía guardarla.
    const enviados: unknown[] = []
    adaptador.restaurar()
    adaptador = instalarAdaptadorFalso((config) => {
      if (config.method?.toLowerCase() === 'post') {
        enviados.push(JSON.parse(String(config.data)))
        return { data: checklistGuardado(['temperatura']) }
      }
      return { data: null }
    })
    const usuario = userEvent.setup()

    render(<ChecklistBPAPage />)
    const items = await screen.findAllByRole('button', { pressed: false })
    await usuario.click(items[0])

    const guardar = screen.getByRole('button', { name: /guardar verificación/i })
    expect(guardar).toBeEnabled()
    await usuario.click(guardar)

    await waitFor(() => expect(enviados).toHaveLength(1))
    expect(enviados[0]).toMatchObject({ temperatura: true, termometro: false })
  })

  it('advierte cuántos ítems quedarán declarados como no conformes', async () => {
    const usuario = userEvent.setup()
    render(<ChecklistBPAPage />)
    const items = await screen.findAllByRole('button', { pressed: false })

    await usuario.click(items[0])

    expect(await screen.findByText(/9 ítem\(s\) declarado\(s\) como no conforme/i)).toBeInTheDocument()
  })

  it('envía la fecha de hoy y las observaciones escritas', async () => {
    const enviados: Record<string, unknown>[] = []
    adaptador.restaurar()
    adaptador = instalarAdaptadorFalso((config) => {
      if (config.method?.toLowerCase() === 'post') {
        enviados.push(JSON.parse(String(config.data)))
        return { data: checklistGuardado([]) }
      }
      return { data: null }
    })
    const usuario = userEvent.setup()

    render(<ChecklistBPAPage />)
    await screen.findAllByRole('button', { pressed: false })
    await usuario.type(screen.getByLabelText(/observaciones/i), 'Puerta con holgura')
    await usuario.click(screen.getByRole('button', { name: /guardar verificación/i }))

    await waitFor(() => expect(enviados).toHaveLength(1))
    expect(enviados[0].observaciones).toBe('Puerta con holgura')
    expect(enviados[0].fecha).toBe(fechaISOlocal())
  })

  it('informa del fallo si el backend rechaza el guardado', async () => {
    adaptador.restaurar()
    adaptador = instalarAdaptadorFalso((config) =>
      config.method?.toLowerCase() === 'post' ? { status: 500, data: {} } : { data: null },
    )
    const usuario = userEvent.setup()

    render(<ChecklistBPAPage />)
    await screen.findAllByRole('button', { pressed: false })
    await usuario.click(screen.getByRole('button', { name: /guardar verificación/i }))

    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent(/no se pudo guardar/i)
  })

  it('avisa si no puede cargar la verificación del día', async () => {
    adaptador.restaurar()
    adaptador = instalarAdaptadorFalso(() => ({ status: 500, data: {} }))

    render(<ChecklistBPAPage />)

    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})
