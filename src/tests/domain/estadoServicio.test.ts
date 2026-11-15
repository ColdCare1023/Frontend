import { describe, expect, it } from 'vitest'

import {
  esConsumidorUnico,
  estadoMigraciones,
  modeloIARechazado,
  motivosDegradado,
  normalizarEstadoServicio,
  situacionRespaldos,
} from '@/domain/entities/EstadoServicio'
import { esIpPublica } from '@/domain/value-objects/DireccionIp'

describe('esIpPublica — «IP de cliente pública» sin mostrar la IP', () => {
  it.each([
    '10.0.0.1', '10.255.255.255',
    '172.16.0.1', '172.31.255.254',
    '192.168.1.10',
    '100.64.0.1', '100.127.255.254', // CGNAT
    '127.0.0.1', '127.8.8.8',
    '169.254.10.1', '0.0.0.0',
    '::1', '::',
    'fc00::1', 'fd12:3456:789a::1', // fc00::/7
    'fe80::1', 'febf::abcd', // fe80::/10
    '::ffff:10.0.0.1', '::ffff:192.168.0.5', // IPv4 mapeada
  ])('%s no es pública', (ip) => {
    expect(esIpPublica(ip)).toBe(false)
  })

  it.each(['8.8.8.8', '203.0.113.24', '172.32.0.1', '172.15.255.255', '100.63.255.255', '100.128.0.1', '192.169.0.1', '2001:db8::1', '2800:200:e840::12', '::ffff:8.8.4.4'])(
    '%s es pública',
    (ip) => {
      expect(esIpPublica(ip)).toBe(true)
    },
  )

  it.each([null, undefined, '', 'testclient', '256.1.1.1', '1.2.3', '1:2:3:4:5:6:7:8:9', '1::2::3', 42])('%s no es una IP: no determinable', (valor) => {
    expect(esIpPublica(valor)).toBeNull()
  })
})

describe('normalizarEstadoServicio', () => {
  const crudo = {
    status: 'ok',
    timestamp: '2026-11-15T15:30:00+00:00',
    db: 'ok',
    alembic_revision: 'a',
    alembic_head: 'a',
    broker_api: 'sin_configurar',
    proxy: { forwarded_allow_ips: '*', esquema: 'https', ip_cliente: '203.0.113.24', x_forwarded_for_presente: true },
    respaldos: { vigilancia_activa: true, estado: null, ultimo_completado: null, ultima_pasada: null },
  }

  it('no conserva la IP del cliente; sí FORWARDED_ALLOW_IPS, que es configuración del servidor', () => {
    const e = normalizarEstadoServicio(crudo)!
    expect(e.proxy).toEqual({ forwarded_allow_ips: '*', esquema: 'https', x_forwarded_for_presente: true, ip_cliente_publica: true })
    expect(JSON.stringify(e)).not.toContain('203.0.113.24')
    expect(normalizarEstadoServicio({ ...crudo, proxy: { esquema: 'https' } })!.proxy?.forwarded_allow_ips).toBeNull()
  })

  it('sin `status` no es un estado de servicio (vacío)', () => {
    expect(normalizarEstadoServicio({})).toBeNull()
    expect(normalizarEstadoServicio(null)).toBeNull()
    expect(normalizarEstadoServicio('ok')).toBeNull()
    expect(normalizarEstadoServicio([])).toBeNull()
  })

  it('un `status` desconocido no se presenta como «ok»', () => {
    expect(normalizarEstadoServicio({ status: 'raro' })!.status).toBe('degradado')
  })

  it('lo que un backend anterior no trae queda en null', () => {
    const e = normalizarEstadoServicio({ status: 'ok', db: 'ok' })!
    expect(e).toMatchObject({ alembic_head: null, arranque: null, respaldos: null, modelo_ia: null, mqtt: null, broker_api: null })
  })
})

describe('reglas derivadas', () => {
  const base = normalizarEstadoServicio({ status: 'ok', db: 'ok', alembic_revision: 'r1', alembic_head: 'r1', broker_api: 'ok' })!

  it('migraciones: al día, pendientes o sin dato', () => {
    expect(estadoMigraciones(base)).toBe('al_dia')
    expect(estadoMigraciones({ ...base, alembic_revision: 'r0' })).toBe('pendientes')
    expect(estadoMigraciones({ ...base, alembic_head: null })).toBe('sin_dato')
  })

  it('consumidor único solo con scripts.arrancar_api y exactamente 1 worker', () => {
    expect(esConsumidorUnico({ lanzador: 'scripts.arrancar_api', workers: 1 })).toBe(true)
    expect(esConsumidorUnico({ lanzador: 'scripts.arrancar_api', workers: 2 })).toBe(false)
    expect(esConsumidorUnico({ lanzador: null, workers: 1 })).toBe(false)
    expect(esConsumidorUnico({ lanzador: 'uvicorn', workers: 1 })).toBe(false)
    expect(esConsumidorUnico(null)).toBe(false)
  })

  it('respaldos: fallido/vencido mandan; null o sin vigilante es «sin vigilancia»', () => {
    const r = { vigilancia_activa: true, estado: null, ultimo_completado: '2026-11-15T07:00:47+00:00', ultima_pasada: '2026-11-15T15:26:00+00:00' }
    expect(situacionRespaldos(r)).toBe('al_dia')
    expect(situacionRespaldos({ ...r, estado: 'fallido' })).toBe('fallido')
    expect(situacionRespaldos({ ...r, vigilancia_activa: false, estado: 'vencido' })).toBe('vencido')
    expect(situacionRespaldos({ ...r, vigilancia_activa: false })).toBe('sin_vigilancia')
    expect(situacionRespaldos(null)).toBe('sin_vigilancia')
  })

  it('respaldos: `estado: null` sin prueba de nada no es «al día»', () => {
    // La primera pasada del vigilante aún no termina (o lanzó una excepción).
    const sinPasada = { vigilancia_activa: true, estado: null, ultimo_completado: null, ultima_pasada: null }
    expect(situacionRespaldos(sinPasada)).toBe('sin_pasada')
    // RESPALDO_MAX_ANTIGUEDAD_HORAS=0 (por omisión) y ningún respaldo hecho nunca.
    expect(situacionRespaldos({ ...sinPasada, ultima_pasada: '2026-11-15T15:26:00+00:00' })).toBe('sin_respaldos')
    // Un fallo o un vencimiento siguen mandando aunque no haya pasada registrada.
    expect(situacionRespaldos({ ...sinPasada, estado: 'vencido' })).toBe('vencido')
  })

  it('motivos de «degradado» con la regla del backend', () => {
    expect(motivosDegradado(base)).toEqual([])
    const ia = normalizarEstadoServicio({ status: 'degradado', db: 'error: OperationalError', broker_api: 'error', modelo_ia: { preventivo: { motivo_rechazo: 'hash' } } })!
    expect(modeloIARechazado(ia.modelo_ia)).toBe(true)
    expect(motivosDegradado(ia)).toEqual(['db', 'broker_api', 'modelo_ia'])
  })
})
