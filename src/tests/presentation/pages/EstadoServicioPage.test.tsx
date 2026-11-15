import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import i18n from '@/infrastructure/i18n'
import { fechaHora } from '@/lib/formato'
import { EstadoServicioPage } from '@/presentation/pages/EstadoServicioPage'
import { instalarAdaptadorFalso } from '../../ayudas'

/** IP de documentación (RFC 5737) y lista de proxies: nunca deben llegar al DOM. */
const IP_CLIENTE = '203.0.113.24'
const PROXIES_CONFIANZA = '100.64.0.0/10'

/** Respuesta de GET /health/detalle con la forma de src/interface/main.py del backend. */
function estado(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    status: 'ok',
    timestamp: '2026-11-15T15:30:00+00:00',
    db: 'ok',
    alembic_revision: '0042_bigint_identidad',
    alembic_head: '0042_bigint_identidad',
    broker_api: 'ok',
    mqtt: { habilitado: true, tarea_activa: true, conectado: true, desde: '2026-11-15T12:00:00+00:00' },
    notificaciones: { worker_activo: true, cola_pendiente: 0 },
    arranque: { lanzador: 'scripts.arrancar_api', workers: 1 },
    proxy: { forwarded_allow_ips: PROXIES_CONFIANZA, esquema: 'https', ip_cliente: IP_CLIENTE, x_forwarded_for_presente: true },
    vigilancia_sin_datos: { activa: true, ultima_pasada: '2026-11-15T15:29:40+00:00' },
    respaldos: { vigilancia_activa: true, estado: null, ultimo_completado: '2026-11-15T07:00:47+00:00', ultima_pasada: '2026-11-15T15:26:00+00:00' },
    modelo_ia: {
      disponible: false,
      version: null,
      motivo_rechazo: null,
      motivo_codigo: 'no_entrenado',
      modo_legado: 'experimental',
      modo_legado_efectivo: 'experimental',
      preventivo: { modo: 'desactivado', motivo_rechazo: null, motivo_codigo: 'modo_desactivado', disponible: false, version: null, es_version_activa_registrada: false },
      version_activa_registrada: null,
      en_uso: { modelo: 'regla_2_8', version: null, disponible: false, aprobado: false },
    },
    ...over,
  }
}

let adaptador: ReturnType<typeof instalarAdaptadorFalso>

function montar(respuesta: { status?: number; data?: unknown } | (() => { status?: number; data?: unknown })) {
  adaptador = instalarAdaptadorFalso(typeof respuesta === 'function' ? respuesta : () => respuesta)
  return render(<EstadoServicioPage />)
}

/** Fecha local como la lee Testing Library (los espacios duros se normalizan). */
const fecha = (iso: string) => fechaHora(iso).replace(/\s+/g, ' ')

const region = (nombre: string) => screen.getByRole('region', { name: nombre })

beforeEach(async () => {
  await i18n.changeLanguage('es')
})
afterEach(() => adaptador?.restaurar())

describe('EstadoServicioPage — GET /health/detalle (solo administrador)', () => {
  it('estado ok: general, BD, MQTT, arranque, proxy, respaldos y hora de la consulta en hora local', async () => {
    montar({ data: estado() })

    expect(screen.getByRole('heading', { level: 1, name: 'Estado del servicio' })).toBeInTheDocument()
    expect(await screen.findByText('Operativo')).toBeInTheDocument()
    expect(adaptador.peticiones).toHaveLength(1)
    expect(adaptador.ultima()).toMatchObject({ method: 'get', url: '/health/detalle' })
    expect(screen.getByText(`Consulta: ${fecha('2026-11-15T15:30:00+00:00')}`)).toBeInTheDocument()

    const resumen = region('Resumen del servicio')
    expect(resumen).toHaveTextContent('La base de datos y la API del broker responden.')
    expect(within(resumen).getByText('Consumidor MQTT único').nextElementSibling).toHaveTextContent('Sí')

    const bd = region('Base de datos')
    expect(within(bd).getAllByText('Al día').length).toBeGreaterThan(0)
    expect(within(bd).getAllByText('0042_bigint_identidad')).toHaveLength(2)
    expect(bd).toHaveTextContent('Conectada')

    const mqtt = region('MQTT')
    expect(mqtt).toHaveTextContent('Conectado')
    expect(mqtt).toHaveTextContent('Responde')
    expect(mqtt).toHaveTextContent(fecha('2026-11-15T12:00:00+00:00'))

    const arranque = region('Arranque')
    expect(arranque).toHaveTextContent('scripts.arrancar_api')
    expect(arranque).toHaveTextContent('Reproducible')
    expect(arranque).toHaveTextContent('Arrancó con scripts.arrancar_api y 1 worker: un solo consumidor MQTT.')

    expect(region('Proxy')).toHaveTextContent('https')
    expect(region('Notificaciones por correo')).toHaveTextContent('Activo')
    expect(region('Vigilancia SIN_DATOS')).toHaveTextContent(fecha('2026-11-15T15:29:40+00:00'))

    const respaldos = region('Respaldos')
    expect(respaldos).toHaveTextContent('Al día')
    expect(respaldos).toHaveTextContent(fecha('2026-11-15T07:00:47+00:00'))
    expect(respaldos).toHaveTextContent(fecha('2026-11-15T15:26:00+00:00'))

    // Nada interrumpe cuando todo está bien.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('la IA preventiva apagada a propósito se informa como neutra, no como error', async () => {
    montar({ data: estado() })
    const ia = await screen.findByRole('region', { name: 'Modelo de IA' })
    expect(ia).toHaveTextContent('Apagada a propósito')
    expect(ia).toHaveTextContent('Versión activa registrada')
    expect(ia).toHaveTextContent('Ninguna')
    expect(ia).toHaveTextContent(/Regla de 2\u2060–\u20608 °C/)
    expect(ia).toHaveTextContent('siguen operando')
    expect(ia).toHaveAttribute('data-tono', 'neutro')
    expect(ia).not.toHaveTextContent('Artefacto rechazado')
  })

  it('migraciones pendientes: «Pendientes» destacado con la revisión aplicada y la del código', async () => {
    montar({ data: estado({ alembic_revision: '0041_hu20_normalizacion_preventiva' }) })
    const bd = await screen.findByRole('region', { name: 'Base de datos' })
    expect(bd).toHaveAttribute('data-tono', 'aviso')
    expect(within(bd).getByText('Pendientes')).toBeInTheDocument()
    expect(bd).toHaveTextContent('0041_hu20_normalizacion_preventiva')
    expect(bd).toHaveTextContent('0042_bigint_identidad')
    expect(bd).toHaveTextContent('el pre-deploy «alembic upgrade head» no se aplicó')
    expect(region('Resumen del servicio')).toHaveTextContent('Migraciones pendientes')
  })

  it.each([
    ['fallido', 'El último respaldo programado falló.'],
    ['vencido', 'El respaldo programado está vencido'],
  ])('respaldo %s: aviso crítico visible (role=alert) que dice qué hacer', async (estadoRespaldo, texto) => {
    montar({ data: estado({ respaldos: { vigilancia_activa: true, estado: estadoRespaldo, ultimo_completado: '2026-11-13T07:00:40+00:00', ultima_pasada: '2026-11-15T15:26:00+00:00' } }) })
    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent(texto)
    expect(alerta).toHaveTextContent('Revise el servicio cron de respaldo.')
    expect(alerta).toHaveTextContent(fecha('2026-11-13T07:00:40+00:00'))
    expect(region('Respaldos')).toHaveAttribute('data-tono', 'critico')
  })

  it.each([
    ['el bloque viene null', null],
    ['no hay vigilante', { vigilancia_activa: false, estado: null, ultimo_completado: null, ultima_pasada: null }],
  ])('sin vigilancia de respaldos cuando %s', async (_caso, respaldos) => {
    montar({ data: estado({ respaldos }) })
    const bloque = await screen.findByRole('region', { name: 'Respaldos' })
    expect(bloque).toHaveTextContent('Sin vigilancia de respaldos')
    expect(region('Resumen del servicio')).toHaveTextContent('Sin vigilancia de respaldos')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('arranque no reproducible: 2 workers son 2 consumidores MQTT', async () => {
    montar({ data: estado({ arranque: { lanzador: 'scripts.arrancar_api', workers: 2 } }) })
    const arranque = await screen.findByRole('region', { name: 'Arranque' })
    expect(arranque).toHaveAttribute('data-tono', 'critico')
    expect(arranque).toHaveTextContent('Varios consumidores')
    expect(arranque).toHaveTextContent('Con 2 workers habría 2 consumidores MQTT procesando la misma telemetría.')
    expect(within(region('Resumen del servicio')).getByText('Consumidor MQTT único').nextElementSibling).toHaveTextContent('No')
  })

  it('arranque no reproducible: sin lanzador registrado (otro comando de arranque)', async () => {
    montar({ data: estado({ arranque: { lanzador: null, workers: null } }) })
    const arranque = await screen.findByRole('region', { name: 'Arranque' })
    expect(arranque).toHaveAttribute('data-tono', 'aviso')
    expect(arranque).toHaveTextContent('No reproducible')
    expect(arranque).toHaveTextContent('Sin registrar')
    expect(arranque).toHaveTextContent('El proceso no arrancó con scripts.arrancar_api')
    expect(arranque).not.toHaveTextContent('Arrancó con scripts.arrancar_api y 1 worker')
  })

  it('proxy http sin X-Forwarded-For: pide revisar el proxy', async () => {
    montar({ data: estado({ proxy: { forwarded_allow_ips: '127.0.0.1', esquema: 'http', ip_cliente: '100.64.3.7', x_forwarded_for_presente: false } }) })
    const proxy = await screen.findByRole('region', { name: 'Proxy' })
    expect(proxy).toHaveAttribute('data-tono', 'aviso')
    expect(proxy).toHaveTextContent('Revisar')
    expect(within(proxy).getByText('Esquema recibido').nextElementSibling).toHaveTextContent('http')
    expect(proxy).toHaveTextContent('El backend recibe las peticiones como http')
    expect(within(proxy).getByText('IP de cliente pública').nextElementSibling).toHaveTextContent('No')
    expect(proxy).toHaveTextContent('probablemente la del proxy')
    expect(document.body.innerHTML).not.toContain('100.64.3.7')
  })

  it('la IP del cliente y FORWARDED_ALLOW_IPS nunca llegan al DOM; solo si la IP es pública', async () => {
    const { container } = montar({ data: estado() })
    const proxy = await screen.findByRole('region', { name: 'Proxy' })
    expect(within(proxy).getByText('IP de cliente pública').nextElementSibling).toHaveTextContent('Sí')
    expect(proxy).toHaveTextContent('La IP del cliente no se muestra')
    expect(container.innerHTML).not.toContain(IP_CLIENTE)
    expect(container.innerHTML).not.toContain(PROXIES_CONFIANZA)
    expect(document.body.textContent).not.toContain(IP_CLIENTE)
  })

  it('error 403: solo el administrador, sin datos ni botón de actualizar', async () => {
    montar({ status: 403, data: { detail: 'No tiene permisos para esta operación' } })
    expect(await screen.findByRole('alert')).toHaveTextContent('Solo el administrador puede consultar el estado del servicio.')
    expect(screen.queryByText('Operativo')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /actualizar/i })).not.toBeInTheDocument()
  })

  it('error 401: la sesión no es válida', async () => {
    montar({ status: 401, data: { detail: 'Sesión no válida' } })
    expect(await screen.findByRole('alert')).toHaveTextContent('Tu sesión expiró')
  })

  it('error de red: ofrece volver a intentar y, al responder, muestra el estado', async () => {
    let fallar = true
    montar(() => (fallar ? { status: 500, data: {} } : { data: estado() }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos consultar el estado del servicio.')
    fallar = false
    await userEvent.click(screen.getByRole('button', { name: 'Volver a intentar' }))
    expect(await screen.findByText('Operativo')).toBeInTheDocument()
    expect(adaptador.peticiones).toHaveLength(2)
  })

  it('respuesta sin estado: vacío con «Actualizar»', async () => {
    montar({ data: {} })
    expect(await screen.findByText('Sin estado del servicio')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeInTheDocument()
  })

  it('«Actualizar» vuelve a consultar; si falla, conserva los datos anteriores y lo dice', async () => {
    let respuesta: { status?: number; data?: unknown } = { data: estado() }
    montar(() => respuesta)
    await screen.findByText('Operativo')
    respuesta = { status: 502, data: {} }
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar' }))
    await waitFor(() => expect(adaptador.peticiones).toHaveLength(2))
    expect(await screen.findByText(/No se pudo actualizar: se muestran los datos de la consulta anterior/)).toBeInTheDocument()
    expect(screen.getByText('Operativo')).toBeInTheDocument()
  })

  it('degradado: dice por qué (misma regla que el backend)', async () => {
    montar({ data: estado({ status: 'degradado', db: 'error: OperationalError', broker_api: 'error' }) })
    const resumen = await screen.findByRole('region', { name: 'Resumen del servicio' })
    expect(resumen).toHaveTextContent('Degradado')
    expect(resumen).toHaveTextContent('Degradado por: base de datos con error y API del broker con error.')
    expect(region('Base de datos')).toHaveTextContent('Error: OperationalError')
    expect(region('MQTT')).toHaveTextContent('La verificación de la API del broker al arrancar falló')
  })

  it('un artefacto de IA rechazado se marca y explica que degrada el estado', async () => {
    const base = estado()
    montar({
      data: estado({
        status: 'degradado',
        modelo_ia: { ...(base.modelo_ia as object), motivo_rechazo: 'Checksum distinto', motivo_codigo: 'checksum_invalido' },
      }),
    })
    const ia = await screen.findByRole('region', { name: 'Modelo de IA' })
    expect(ia).toHaveAttribute('data-tono', 'aviso')
    expect(ia).toHaveTextContent('Artefacto rechazado')
    expect(ia).toHaveTextContent('La huella del artefacto no coincide')
    expect(region('Resumen del servicio')).toHaveTextContent('modelo de IA rechazado')
  })

  it('backend anterior (sin alembic_head, arranque, respaldos ni modelo_ia): no inventa nada', async () => {
    const anterior = estado()
    for (const clave of ['alembic_head', 'arranque', 'respaldos', 'modelo_ia']) delete anterior[clave]
    montar({ data: anterior })
    await screen.findByText('Operativo')
    expect(region('Base de datos')).toHaveTextContent('El backend no informó la revisión aplicada')
    expect(region('Arranque')).toHaveTextContent('El backend no informa con qué comando arrancó.')
    expect(region('Respaldos')).toHaveTextContent('Sin vigilancia de respaldos')
    expect(region('Modelo de IA')).toHaveTextContent('El backend no informa el estado del modelo de IA.')
  })
})
