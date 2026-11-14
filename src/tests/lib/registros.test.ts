import { describe, expect, it } from 'vitest'

import { agruparPorDia, claveDia } from '@/lib/agruparPorDia'
import { primerCaracterDistinto } from '@/lib/compararSellos'
import { etiquetaDia } from '@/lib/formato'
import { resumenPeriodo } from '@/lib/resumenTermico'
import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import es from '@/infrastructure/i18n/locales/es.json'
import { clasificarAccion } from '@/presentation/pages/auditoria/categoriasAuditoria'
import { iconoEvento } from '@/presentation/pages/trazabilidad/iconosEvento'
import { Link2, LogIn, Lock, ScrollText, ShieldX, Thermometer } from 'lucide-react'

const local = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m - 1, d, h, min).toISOString()

describe('agruparPorDia', () => {
  it('agrupa por día local y no por fecha UTC', () => {
    expect(claveDia(local(2026, 11, 13, 23, 30))).toBe('2026-11-13')
  })

  it('conserva el orden descendente de entrada', () => {
    const filas = [local(2026, 11, 14, 9), local(2026, 11, 14, 8), local(2026, 11, 13, 22)]
    const grupos = agruparPorDia(filas, (f) => f)
    expect(grupos.map((g) => [g.clave, g.filas.length])).toEqual([
      ['2026-11-14', 2],
      ['2026-11-13', 1],
    ])
  })

  it('etiqueta Hoy y Ayer', () => {
    const t = (clave: string) => (clave === 'comunes.hoy' ? 'Hoy' : 'Ayer')
    const ahora = new Date(2026, 10, 14, 12)
    expect(etiquetaDia(local(2026, 11, 14, 1), t, ahora)).toBe('Hoy')
    expect(etiquetaDia(local(2026, 11, 13, 23), t, ahora)).toBe('Ayer')
  })
})

describe('compararSellos', () => {
  it('devuelve el primer carácter distinto o −1 si son iguales', () => {
    expect(primerCaracterDistinto('abc', 'abc')).toBe(-1)
    expect(primerCaracterDistinto('abcd', 'abxd')).toBe(2)
  })
})

describe('resumenTermico', () => {
  const lectura = (over: Partial<LecturaTermica>): LecturaTermica =>
    ({ id: 'x', device_id: 'FARM-01-CDL', timestamp: local(2026, 11, 14, 9), temperatura_interna: 5, excursion_confirmada: false, riesgo_efectivo: 'normal', ...over }) as LecturaTermica

  it('resume por equipo sin mezclar FARM-01-CDL y FARM-02-CDL e ignora temperaturas nulas', () => {
    const resumen = resumenPeriodo([
      lectura({ id: 'a', temperatura_interna: 3 }),
      lectura({ id: 'b', device_id: 'FARM-02-CDL', temperatura_interna: 7 }),
      lectura({ id: 'c', temperatura_interna: null, timestamp: local(2026, 11, 14, 8) }),
    ])
    expect(resumen.equipos.map((e) => [e.equipo, e.min, e.max])).toEqual([
      ['FARM-01-CDL', 3, 3],
      ['FARM-02-CDL', 7, 7],
    ])
    expect(resumen.min).toBe(3)
    expect(resumen.max).toBe(7)
  })
})

describe('categoriasAuditoria e iconosEvento', () => {
  it('clasifica los códigos del backend en su categoría e icono', () => {
    expect(clasificarAccion('LOGIN_FALLIDO')).toEqual({ categoria: 'acceso', icono: LogIn })
    expect(clasificarAccion('BLOQUEO_TEMPORAL')).toEqual({ categoria: 'acceso', icono: Lock })
    expect(clasificarAccion('RBAC_DENEGADO')).toEqual({ categoria: 'acceso', icono: ShieldX })
  })

  it('un código desconocido cae en Otras sin romper', () => {
    expect(clasificarAccion('ALGO_NUEVO')).toEqual({ categoria: 'otros', icono: ScrollText })
  })

  it('toda clave de auditoria.eventos tiene una categoría distinta de Otras', () => {
    const sinCategoria = Object.keys(es.auditoria.eventos).filter((codigo) => clasificarAccion(codigo).categoria === 'otros')
    expect(sinCategoria).toEqual([])
  })

  it('cada tipo conocido tiene icono; el desconocido usa Link2', () => {
    expect(iconoEvento('LECTURA_REGISTRADA')).toBe(Thermometer)
    expect(iconoEvento('TIPO_RARO')).toBe(Link2)
  })
})
