import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { olvidarClasificacionPreventiva } from '@/application/hooks/useClasificacionPreventiva'
import { useAuthStore } from '@/application/stores/authStore'
import type { Rol } from '@/domain/value-objects/Rol'
import { construirCinta24h } from '@/lib/cinta24h'
import { Cinta24hAlertas } from '@/presentation/pages/alertas/Cinta24hAlertas'
import type { AlertaTermica } from '@/domain/entities/AlertaTermica'
import { esperarMicrotasks, instalarAdaptadorFalso } from '../../ayudas'

const AHORA = Date.parse('2026-11-14T12:00:00Z')

function alerta(nivel: 'excursion_critica' | 'riesgo_preventivo'): AlertaTermica {
  return {
    id: `a-${nivel}`,
    device_id: 'FARM-01',
    nivel_riesgo: nivel,
    estado: 'pendiente',
    mensaje: '',
    created_at: '2026-11-14T10:00:00Z',
    episodio_abierto: false,
    resuelta_en: '2026-11-14T10:20:00Z',
  } as unknown as AlertaTermica
}

const OPERATIVA = { modo: 'activo', disponible: true, version: 'p-1', version_activa_registrada: 'p-1', es_version_activa_registrada: true }
const FUERA = { modo: 'desactivado', disponible: false, motivo_codigo: 'modo_desactivado' }

function sesion(rol: Rol) {
  useAuthStore.setState({ usuario: { id: 'u-1', email: `${rol}@upc.pe`, rol, expiraEn: Date.now() + 3_600_000 }, autenticado: true })
}

const leyenda = () => screen.getAllByRole('listitem').map((li) => li.textContent?.trim())

/** HU-20: «Preventiva» solo si el backend informa la clasificación preventiva en operación (o hay tramos que rotular). */
describe('Cinta 24 h de Alertas — rótulos preventivos (HU-20)', () => {
  let adaptador: ReturnType<typeof instalarAdaptadorFalso> | undefined
  beforeEach(() => olvidarClasificacionPreventiva())
  afterEach(() => {
    adaptador?.restaurar()
    useAuthStore.setState({ usuario: null, autenticado: false })
  })

  it('fuera de operación y sin tramos preventivos: ni leyenda ni resumen la mencionan', async () => {
    sesion('farmaceutico')
    adaptador = instalarAdaptadorFalso(() => ({ data: FUERA }))
    render(<Cinta24hAlertas cintas={construirCinta24h([alerta('excursion_critica')], [], AHORA)} cargando={false} />)
    await waitFor(() => expect(adaptador!.peticiones).toHaveLength(1))
    await esperarMicrotasks()
    expect(leyenda()).not.toContain('Preventiva')
    expect(leyenda()).toContain('Crítica')
    const cinta = screen.getByRole('img')
    expect(cinta.getAttribute('aria-label')).not.toMatch(/preventiv/i)
    expect(cinta.getAttribute('aria-label')).toMatch(/tramos críticos y \d+ sin datos/)
  })

  it('en operación: la leyenda y el resumen incluyen la preventiva', async () => {
    sesion('farmaceutico')
    adaptador = instalarAdaptadorFalso(() => ({ data: OPERATIVA }))
    render(<Cinta24hAlertas cintas={construirCinta24h([alerta('excursion_critica')], [], AHORA)} cargando={false} />)
    await waitFor(() => expect(leyenda()).toContain('Preventiva'))
    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/0 preventivos/)
  })

  it('con tramos preventivos registrados se rotulan aunque hoy no opere', async () => {
    sesion('auditor')
    adaptador = instalarAdaptadorFalso(() => ({ data: FUERA }))
    render(<Cinta24hAlertas cintas={construirCinta24h([alerta('riesgo_preventivo')], [], AHORA)} cargando={false} />)
    await waitFor(() => expect(adaptador!.peticiones).toHaveLength(1))
    await esperarMicrotasks()
    expect(leyenda()).toContain('Preventiva')
    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/[1-9]\d* preventivos/)
  })

  it('el técnico no consulta el estado y no ve la preventiva sin tramos que la justifiquen', async () => {
    sesion('tecnico')
    adaptador = instalarAdaptadorFalso(() => ({ data: OPERATIVA }))
    render(<Cinta24hAlertas cintas={construirCinta24h([alerta('excursion_critica')], [], AHORA)} cargando={false} />)
    await esperarMicrotasks()
    expect(adaptador.peticiones).toHaveLength(0)
    expect(leyenda()).not.toContain('Preventiva')
  })
})
