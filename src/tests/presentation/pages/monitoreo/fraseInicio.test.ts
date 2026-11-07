import { describe, expect, it } from 'vitest'

import type { Dispositivo } from '@/domain/entities/Dispositivo'
import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { articuloDe, causaDelEquipo, ordenarResumenes, tieneIncidencias } from '@/presentation/pages/monitoreo/estadoEquipo'
import { segundosRedondeados, tiempoBreve } from '@/presentation/pages/monitoreo/reloj'
import { fraseDelPeriodo } from '@/presentation/pages/monitoreo/resumenPeriodo'

const HORA = 60 * 60 * 1000
const FIN = Date.parse('2026-07-25T12:00:00Z')
const VENTANA = { desde: FIN - 24 * HORA, hasta: FIN }

function lectura(ms: number, temperatura: number | null = 5, extra: Partial<LecturaTermica> = {}): LecturaTermica {
  return {
    id: String(ms),
    device_id: 'FARM-01-CDL',
    timestamp: new Date(ms).toISOString(),
    temperatura_ambiental: 21,
    humedad_ambiental: 60,
    temperatura_interna: temperatura,
    apertura_refrigerador: false,
    duracion_apertura_segundos: 0,
    estado_conectividad: 'online',
    nivel_riesgo: 'normal',
    excursion_confirmada: temperatura != null && (temperatura < 2 || temperatura > 8),
    riesgo_efectivo: 'normal',
    confianza_ia: 0.9,
    modelo_version: '1',
    origen_clasificacion: 'random_forest',
    estado_inferencia: 'completada',
    motivo_no_inferencia: null,
    ...extra,
  }
}

/** Una lectura cada 10 min de punta a punta de la ventana. */
function dia(temperatura: (i: number) => number = () => 5) {
  return Array.from({ length: 24 * 6 + 1 }, (_, i) => lectura(VENTANA.desde + i * 10 * 60 * 1000, temperatura(i)))
}

describe('fraseDelPeriodo: solo dice lo que las lecturas sostienen', () => {
  it('«Hoy estuvo dentro del rango todo el día» exige lecturas de punta a punta', () => {
    expect(fraseDelPeriodo(dia(), VENTANA, 24, false)).toEqual({ clave: 'dashboard.periodoHoyBien' })
  })

  it('cuenta las salidas por episodio, no por lectura', () => {
    // Dos episodios: tres lecturas seguidas fuera y, más tarde, una.
    const serie = dia((i) => ([20, 21, 22, 90].includes(i) ? 9 : 5))
    expect(fraseDelPeriodo(serie, VENTANA, 24, false)).toEqual({ clave: 'dashboard.periodoSalio', count: 2 })
  })

  it('con un hueco no afirma «todo el día»', () => {
    const serie = dia().filter((_, i) => i < 40 || i > 70)
    expect(fraseDelPeriodo(serie, VENTANA, 24, false).clave).toBe('dashboard.periodoConHuecos')
  })

  it('si el equipo dejó de reportar, solo hasta la última lectura', () => {
    expect(fraseDelPeriodo(dia(), VENTANA, 24, true).clave).toBe('dashboard.periodoHastaUltima')
  })

  it('una lectura fuera de 2–8 °C sin confirmar no deja decir «dentro del rango»', () => {
    const serie = dia((i) => (i === 50 ? 8.4 : 5)).map((l) => ({ ...l, excursion_confirmada: false }))
    expect(fraseDelPeriodo(serie, VENTANA, 24, false).clave).toBe('dashboard.periodoSinConfirmar')
  })

  it('sin lecturas con temperatura lo dice', () => {
    expect(fraseDelPeriodo([lectura(FIN - HORA, null)], VENTANA, 24, false).clave).toBe('dashboard.periodoSinLecturas')
  })
})

describe('causaDelEquipo: las mismas reglas que pintan el campo', () => {
  const base = { equipo: undefined, desactualizado: false, sensorFallido: false, puertaProlongada: false }

  it('un dato viejo es «sin lectura» aunque la última haya sido crítica', () => {
    const critica = lectura(FIN, 9.5, { riesgo_efectivo: 'excursion_critica' })
    expect(causaDelEquipo({ ...base, ultima: critica, desactualizado: true })).toBe('silencio')
  })

  it('manda el riesgo efectivo, no la clase de la IA', () => {
    const divergente = lectura(FIN, 5, { nivel_riesgo: 'excursion_critica', riesgo_efectivo: 'normal' })
    expect(causaDelEquipo({ ...base, ultima: divergente })).toBe('ok')
    expect(causaDelEquipo({ ...base, ultima: lectura(FIN, 7.6, { riesgo_efectivo: 'riesgo_preventivo' }) })).toBe('preventivo')
  })

  it('sensor caído, monitoreo suspendido o sin riesgo calculado no son «ok»', () => {
    expect(causaDelEquipo({ ...base, ultima: lectura(FIN, null) })).toBe('sensor')
    const suspendido = { estado_operativo: 'MONITOREO_SUSPENDIDO' } as Dispositivo
    expect(causaDelEquipo({ ...base, ultima: lectura(FIN), equipo: suspendido })).toBe('suspendido')
    expect(causaDelEquipo({ ...base, ultima: lectura(FIN, 5, { riesgo_efectivo: null }) })).toBe('sinRiesgo')
    expect(causaDelEquipo({ ...base, ultima: lectura(FIN), puertaProlongada: true })).toBe('puerta')
  })

  it('sin lectura distingue «nunca reportó» de «dejó de reportar»', () => {
    expect(causaDelEquipo({ ...base, ultima: null, equipo: { ultimo_reporte_en: null } as Dispositivo })).toBe('sinReporte')
    expect(causaDelEquipo({ ...base, ultima: null, equipo: { ultimo_reporte_en: '2026-07-25T11:00:00Z' } as Dispositivo })).toBe('silencio')
  })

  it('ordena por gravedad: la excursión va antes que el silencio', () => {
    const orden = ordenarResumenes([
      { id: 'a', nombre: 'A', causa: 'silencio', temperatura: null, marca: null },
      { id: 'b', nombre: 'B', causa: 'ok', temperatura: null, marca: null },
      { id: 'c', nombre: 'C', causa: 'critico', temperatura: 9, marca: null },
    ]).map((r) => r.id)
    expect(orden).toEqual(['c', 'a', 'b'])
  })
})

describe('textos de la frase', () => {
  it('el artículo concuerda con el nombre del equipo', () => {
    expect(articuloDe('Cámara fría de vacunas')).toBe('la')
    expect(articuloDe('Refrigerador principal')).toBe('el')
    expect(articuloDe('Congeladora 2')).toBe('la')
    expect(articuloDe('FARM-01-CDL')).toBe('el equipo')
  })

  it('la antigüedad se dice en su unidad y solo cambia cuando cambia lo que se lee', () => {
    expect(tiempoBreve(45, 'es-PE')).toBe('45\u00a0s')
    expect(tiempoBreve(125, 'es-PE')).toBe('2\u00a0min')
    expect(tiempoBreve(3 * 3600 + 100, 'es-PE')).toBe('3\u00a0h')
    expect(tiempoBreve(2 * 86_400, 'es-PE')).toBe('2\u00a0días')
    expect(segundosRedondeados(130)).toBe(segundosRedondeados(140))
  })

  it('las incidencias se filtran igual que el endpoint sin «todos»', () => {
    expect(tieneIncidencias({ estado_operativo: 'OPERATIVO' } as Dispositivo)).toBe(false)
    expect(tieneIncidencias({ estado_operativo: 'SIN_DATOS' } as Dispositivo)).toBe(true)
    expect(tieneIncidencias({ estado_operativo: 'OPERATIVO', buffer_littlefs: { pendientes: 3 } } as Dispositivo)).toBe(true)
    expect(tieneIncidencias({ estado_operativo: 'OPERATIVO', incidencias_operativas: [{}] } as Dispositivo)).toBe(true)
  })
})
