import { beforeEach, describe, expect, it } from 'vitest'

import {
  aplicarLectura,
  estadoDeEquipo,
  resumirAlertas,
  seleccionarFoco,
  seleccionarIncidencias,
  useEstadoVivoStore,
  type EquipoVivo,
  type LecturaVivo,
} from '@/application/stores/estadoVivoStore'
import type { AlertaTermica } from '@/domain/entities/AlertaTermica'

const equipo = (id: string, extra: Partial<EquipoVivo> = {}): EquipoVivo => ({
  id,
  nombre: `Equipo ${id}`,
  estadoOperativo: 'OPERATIVO',
  conectividad: 'online',
  ultimoReporteEn: null,
  ...extra,
})
const lectura = (temperatura: number, riesgo: LecturaVivo['riesgo'], timestamp: string): LecturaVivo => ({ temperatura, riesgo, timestamp })

describe('estadoVivoStore: selectores puros', () => {
  beforeEach(() => useEstadoVivoStore.getState().reiniciar())

  it('elige como foco el equipo con peor riesgo térmico y, a igualdad, la lectura más reciente', () => {
    const equipos = [equipo('A'), equipo('B'), equipo('C')]
    const ultimas = {
      A: lectura(5, 'normal', '2026-11-14T10:00:00Z'),
      B: lectura(8.6, 'riesgo_preventivo', '2026-11-14T09:00:00Z'),
      C: lectura(8.4, 'riesgo_preventivo', '2026-11-14T10:05:00Z'),
    }
    expect(seleccionarFoco(equipos, ultimas)?.equipo.id).toBe('C')
  })

  it('cuenta como incidencia sin datos, sin conexión, suspendido y falla de sensor fuera del foco', () => {
    const equipos = [
      equipo('foco'),
      equipo('sd', { estadoOperativo: 'SIN_DATOS' }),
      equipo('off', { conectividad: 'offline' }),
      equipo('sus', { estadoOperativo: 'MONITOREO_SUSPENDIDO' }),
      equipo('fs', { estadoOperativo: 'FALLA_SENSOR' }),
      equipo('ok'),
    ]
    const ultimas = { foco: lectura(5, 'normal', '2026-11-14T10:00:00Z'), ok: lectura(4, 'normal', '2026-11-14T09:00:00Z') }
    const incidencias = seleccionarIncidencias(equipos, ultimas, 'foco')
    expect(incidencias.cantidad).toBe(4)
    expect(incidencias.tono).toBe('critico')
  })

  it('distingue sin datos de un riesgo: nunca es crítico', () => {
    expect(estadoDeEquipo(equipo('x', { estadoOperativo: 'SIN_DATOS' }), undefined)).toMatchObject({ clave: 'sin_datos', tono: 'aviso' })
    expect(estadoDeEquipo(equipo('x'), undefined)).toMatchObject({ clave: 'sin_lectura', tono: 'neutro' })
  })

  it('ignora una lectura más antigua que la vigente', () => {
    const ultimas = { A: lectura(5, 'normal', '2026-11-14T10:00:00Z') }
    expect(aplicarLectura(ultimas, 'A', lectura(9, 'excursion_critica', '2026-11-14T09:59:00Z'))).toBe(ultimas)
    expect(aplicarLectura(ultimas, 'A', lectura(6, 'normal', '2026-11-14T10:01:00Z')).A.temperatura).toBe(6)
  })

  it('resume alertas sin atender con críticas, truncado y las 3 más recientes', () => {
    const alerta = (id: string, nivel: AlertaTermica['nivel_riesgo'], creada: string) =>
      ({ id, device_id: 'A', nivel_riesgo: nivel, created_at: creada }) as AlertaTermica
    const resumen = resumirAlertas(
      [
        [alerta('1', 'excursion_critica', '2026-11-14T08:00:00Z'), alerta('2', 'riesgo_preventivo', '2026-11-14T09:00:00Z')],
        [alerta('3', 'riesgo_preventivo', '2026-11-14T10:00:00Z'), alerta('4', 'riesgo_preventivo', '2026-11-14T07:00:00Z')],
      ],
      200,
    )
    expect(resumen).toMatchObject({ total: 4, criticas: 1, truncado: false })
    expect(resumen.recientes.map((a) => a.id)).toEqual(['3', '2', '1'])
    expect(resumirAlertas([[alerta('1', 'normal', '')]], 1).truncado).toBe(true)
  })

  it('reiniciar borra equipos, lecturas y alertas', () => {
    useEstadoVivoStore.setState({ equipos: [equipo('A')], ultimas: { A: lectura(5, 'normal', 'x') }, alertas: { total: 1, criticas: 0, truncado: false, recientes: [] } })
    useEstadoVivoStore.getState().reiniciar()
    const estado = useEstadoVivoStore.getState()
    expect(estado.equipos).toEqual([])
    expect(estado.ultimas).toEqual({})
    expect(estado.alertas).toBeNull()
    expect(estado.carga).toBe('cargando')
  })
})
