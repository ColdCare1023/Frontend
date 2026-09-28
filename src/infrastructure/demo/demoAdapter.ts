import {
  AxiosError,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'

import type { AlertaTermica } from '@/domain/entities/AlertaTermica'
import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import type { Rol } from '@/domain/value-objects/Rol'
import { crearTokenDemo, estadoDemo, METRICAS_IA_DEMO } from './datosDemo'

/**
 * Adapter de Axios para el modo demostración: intercepta cada request del
 * apiClient y responde con los datos simulados en memoria. Los hooks y las
 * páginas no cambian en absoluto — creen hablar con el backend real.
 */


/**
 * Compone un PDF válido en el navegador para el modo demostración.
 *
 * En el backend real este documento lo genera ReportLab e incluye el veredicto
 * de integridad calculado sobre la cadena SHA-256 (HU-38). Aquí no hay backend,
 * así que se emite un PDF mínimo pero bien formado —con su tabla xref— y el
 * propio documento advierte que es una muestra. Antes esta ruta no existía en
 * el adapter y el botón de PDF simplemente no descargaba nada.
 */
function pdfDemostracion(params: Record<string, string>): Blob {
  const esc = (t: string) => t.replace(/([()\\])/g, '\\$1')
  const desde = (params.fecha_desde ?? '').slice(0, 10)
  const hasta = (params.fecha_hasta ?? '').slice(0, 10)

  const lineas: Array<[number, string]> = [
    [20, 'Reporte BPA - Cadena de Frio'],
    [13, `Periodo: ${desde} a ${hasta}`],
    [13, `Dispositivo: ${params.device_id || 'todos'}`],
    [11, `Lecturas en el periodo: ${estadoDemo.lecturas.length}`],
    [11, `Alertas registradas: ${estadoDemo.alertas.length}`],
    [11, `Registros de trazabilidad: ${estadoDemo.trazabilidad.length}`],
    [11, 'Cadena SHA-256: integra'],
    [10, 'Documento de DEMOSTRACION generado en el navegador.'],
    [10, 'En la instalacion real lo emite el backend con ReportLab.'],
  ]

  let y = 780
  const texto = lineas
    .map(([tam, linea]) => {
      y -= tam + 12
      return `BT /F1 ${tam} Tf 56 ${y} Td (${esc(linea)}) Tj ET`
    })
    .join('\n')

  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${texto.length} >>\nstream\n${texto}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  objetos.forEach((cuerpo, i) => {
    offsets.push(pdf.length)
    pdf += `${i + 1} 0 obj\n${cuerpo}\nendobj\n`
  })
  const inicioXref = pdf.length
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`
  pdf += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF`

  return new Blob([pdf], { type: 'application/pdf' })
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, ms))
}

function responder<T>(config: InternalAxiosRequestConfig, data: T, status = 200): AxiosResponse<T> {
  return { data, status, statusText: 'OK', headers: {}, config }
}

function fallar(config: InternalAxiosRequestConfig, status: number, mensaje: string): never {
  const respuesta = responder(config, { detail: mensaje }, status)
  throw new AxiosError(mensaje, 'ERR_BAD_REQUEST', config, null, respuesta)
}

function parametros(config: InternalAxiosRequestConfig): Record<string, string> {
  const crudos = (config.params ?? {}) as Record<string, unknown>
  return Object.fromEntries(
    Object.entries(crudos)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => [k, String(v)]),
  )
}

function cuerpoJson(config: InternalAxiosRequestConfig): Record<string, unknown> {
  if (typeof config.data === 'string') {
    try {
      return JSON.parse(config.data) as Record<string, unknown>
    } catch {
      return {}
    }
  }
  return (config.data ?? {}) as Record<string, unknown>
}

function lecturasFiltradas(params: Record<string, string>): LecturaTermica[] {
  let resultado = [...estadoDemo.lecturas].reverse() // más recientes primero
  if (params.device_id) {
    resultado = resultado.filter((l) =>
      l.device_id.toLowerCase().includes(params.device_id.toLowerCase()),
    )
  }
  if (params.nivel_riesgo) resultado = resultado.filter((l) => l.nivel_riesgo === params.nivel_riesgo)
  if (params.desde) resultado = resultado.filter((l) => l.timestamp >= params.desde)
  if (params.hasta) resultado = resultado.filter((l) => l.timestamp <= params.hasta)
  return resultado.slice(0, Number(params.limite ?? 200))
}

function alertasFiltradas(params: Record<string, string>): AlertaTermica[] {
  let resultado = [...estadoDemo.alertas].reverse()
  // HU-23: `estado` es el filtro real; `revisada` se conserva solo por si
  // algún consumidor viejo del demo todavía lo manda.
  if (params.estado) resultado = resultado.filter((a) => a.estado === params.estado)
  if (params.revisada === 'true') resultado = resultado.filter((a) => a.revisada)
  if (params.revisada === 'false') resultado = resultado.filter((a) => !a.revisada)
  return resultado.slice(0, Number(params.limite ?? 200))
}

export const demoAdapter: AxiosAdapter = async (config) => {
  await esperar(180 + Math.random() * 240)

  const metodo = (config.method ?? 'get').toLowerCase()
  const url = (config.url ?? '').split('?')[0]
  const params = parametros(config)

  /* ── Autenticación ─────────────────────────────────────────── */
  if (metodo === 'post' && url === '/api/auth/login') {
    const cuerpo = new URLSearchParams(String(config.data ?? ''))
    const email = cuerpo.get('username') ?? 'farmaceutico@demo.pe'
    return responder(config, { access_token: crearTokenDemo(email), token_type: 'bearer' })
  }
  if (metodo === 'post' && url === '/api/auth/sse-ticket') {
    return responder(config, { ticket: 'ticket-demo' })
  }

  /* ── Lecturas y alertas ─────────────────────────────────────── */
  if (metodo === 'get' && url === '/api/lecturas') {
    return responder(config, lecturasFiltradas(params))
  }
  if (metodo === 'get' && url === '/api/alertas') {
    return responder(config, alertasFiltradas(params))
  }

  // HU-23 Escenario 1: PENDIENTE -> RECONOCIDA. Reconocer dos veces es un
  // 409, igual que en el backend (`AlertaTermica.reconocer()`).
  const revisar = /^\/api\/alertas\/([^/]+)\/revisar$/.exec(url)
  if (metodo === 'patch' && revisar) {
    const alerta = estadoDemo.alertas.find((a) => a.id === revisar[1])
    if (!alerta) fallar(config, 404, 'Alerta no encontrada')
    if (alerta.estado !== 'pendiente') {
      fallar(config, 409, `La alerta ya fue reconocida (estado actual: ${alerta.estado})`)
    }
    alerta.estado = 'reconocida'
    alerta.reconocida_en = new Date().toISOString()
    alerta.revisada = true
    alerta.revisada_por = 'u-01'
    return responder(config, alerta)
  }

  // HU-23 Escenario 2: registrar la acción marca ATENDIDA (desde PENDIENTE o
  // RECONOCIDA — el backend no exige el paso intermedio). Ya atendida es 409.
  const accion = /^\/api\/alertas\/([^/]+)\/acciones-correctivas$/.exec(url)
  if (metodo === 'post' && accion) {
    const alerta = estadoDemo.alertas.find((a) => a.id === accion[1])
    if (!alerta) fallar(config, 404, 'Alerta no encontrada')
    if (alerta.estado === 'atendida') {
      fallar(config, 409, 'La alerta ya fue atendida por otra acción correctiva')
    }
    alerta.estado = 'atendida'
    alerta.atendida_en = new Date().toISOString()

    const nueva = {
      id: `ac-vivo-${Date.now()}`,
      alert_id: accion[1],
      usuario_id: 'u-01',
      descripcion: String(cuerpoJson(config).descripcion ?? ''),
      created_at: new Date().toISOString(),
      corrige_accion_id: null,
    }
    estadoDemo.acciones.push(nueva)
    return responder(config, nueva, 201)
  }

  // HU-23 criterio 4: cronología de atención de una alerta, de solo lectura.
  const listarAcciones = /^\/api\/alertas\/([^/]+)\/acciones-correctivas$/.exec(url)
  if (metodo === 'get' && listarAcciones) {
    const alerta = estadoDemo.alertas.find((a) => a.id === listarAcciones[1])
    if (!alerta) fallar(config, 404, 'Alerta no encontrada')
    const propias = estadoDemo.acciones
      .filter((a) => a.alert_id === listarAcciones[1])
      .sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime())
    return responder(config, propias)
  }

  // HU-28: corrige una justificación creando un nuevo evento que referencia
  // a la anterior, sin sobrescribirla.
  const rectificar = /^\/api\/alertas\/acciones-correctivas\/([^/]+)\/rectificar$/.exec(url)
  if (metodo === 'post' && rectificar) {
    const anterior = estadoDemo.acciones.find((a) => a.id === rectificar[1])
    if (!anterior) fallar(config, 404, 'Acción correctiva no encontrada')
    const rectificacion = {
      id: `ac-vivo-${Date.now()}`,
      alert_id: anterior.alert_id,
      usuario_id: 'u-01',
      descripcion: String(cuerpoJson(config).descripcion ?? ''),
      created_at: new Date().toISOString(),
      corrige_accion_id: anterior.id,
    }
    estadoDemo.acciones.push(rectificacion)
    return responder(config, rectificacion, 201)
  }

  /* ── Trazabilidad ───────────────────────────────────────────── */
  if (metodo === 'get' && url === '/api/trazabilidad/verificar') {
    return responder(config, {
      integra: true,
      total_registros: estadoDemo.trazabilidad.length,
      primer_registro_inconsistente: null,
    })
  }
  if (metodo === 'get' && url === '/api/trazabilidad') {
    let registros = [...estadoDemo.trazabilidad].reverse()
    if (params.tipo_evento) registros = registros.filter((r) => r.tipo_evento === params.tipo_evento)
    return responder(config, registros.slice(0, Number(params.limite ?? 200)))
  }

  /* ── Reportes BPA ───────────────────────────────────────────── */
  if (metodo === 'get' && url === '/api/reportes/bpa') {
    const desde = params.fecha_desde ?? new Date(0).toISOString()
    const hasta = params.fecha_hasta ?? new Date().toISOString()
    const enRango = (ts: string | null) => ts !== null && ts >= desde && ts <= hasta
    return responder(config, {
      device_id: params.device_id ?? null,
      fecha_desde: desde,
      fecha_hasta: hasta,
      lecturas: estadoDemo.lecturas.filter((l) => enRango(l.timestamp)),
      alertas: estadoDemo.alertas.filter((a) => enRango(a.created_at)),
      registros_trazabilidad: estadoDemo.trazabilidad.filter((r) => enRango(r.timestamp)),
    })
  }

  /* ── Checklist BPA (HU-37) ──────────────────────────────────
     Faltaba: en modo demo la página mostraba "No se pudo cargar la
     verificación de hoy", porque el adapter respondía 404 a una ruta que sí
     existe en el backend real. */
  if (metodo === 'get' && url === '/api/checklist-bpa') {
    // `null` —no 404— es el estado normal de "aún no verificado hoy".
    return responder(config, estadoDemo.checklist)
  }
  if (metodo === 'post' && url === '/api/checklist-bpa') {
    const cuerpo = cuerpoJson(config)
    const items = [
      'temperatura', 'termometro', 'registros', 'alertas_revisadas',
      'acciones_documentadas', 'puerta', 'limpieza', 'exclusivo',
      'rotulado', 'respaldo',
    ]
    const conformes = items.filter((i) => cuerpo[i] === true).length
    const guardado = {
      id: `chk-demo-${Date.now()}`,
      usuario_id: 'u-01',
      fecha: String(cuerpo.fecha ?? new Date().toISOString().slice(0, 10)),
      observaciones: (cuerpo.observaciones as string | null) ?? null,
      total_conformes: conformes,
      conforme: conformes === items.length,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...Object.fromEntries(items.map((i) => [i, cuerpo[i] === true])),
    }
    estadoDemo.checklist = guardado
    return responder(config, guardado, 201)
  }
  if (metodo === 'get' && url === '/api/checklist-bpa/historial') {
    return responder(config, estadoDemo.checklist ? [estadoDemo.checklist] : [])
  }

  /* ── Reporte BPA en PDF (HU-38) ─────────────────────────────
     Faltaba: el botón de PDF no descargaba nada en la demo. Aquí se compone
     un PDF mínimo pero VÁLIDO en el navegador. En el backend real lo genera
     ReportLab con el veredicto de integridad calculado sobre la cadena; esto
     es una muestra de la demostración y lo dice en el propio documento. */
  if (metodo === 'get' && url === '/api/reportes/bpa/pdf') {
    return responder(config, pdfDemostracion(params) as unknown, 200)
  }

  /* ── Estado de la cadena (HU-47) ────────────────────────────── */
  if (metodo === 'get' && url === '/api/trazabilidad/estado') {
    return responder(config, { cadena_comprometida: false })
  }

  /* ── Métricas del modelo (RNF-04) ───────────────────────────── */
  if (metodo === 'get' && url === '/api/ia/modelo') {
    return responder(config, METRICAS_IA_DEMO)
  }

  /* ── Dispositivos (HU-30, HU-43, RF-18) ─────────────────────── */
  if (metodo === 'get' && url === '/api/dispositivos') {
    return responder(config, estadoDemo.dispositivos)
  }
  const baja = /^\/api\/dispositivos\/([^/]+)\/baja$/.exec(url)
  if (metodo === 'post' && baja) {
    const d = estadoDemo.dispositivos.find((x) => x.id === baja[1])
    if (!d) fallar(config, 404, 'Dispositivo no encontrado')
    d.activo = false
    d.motivo_baja = String(cuerpoJson(config).motivo ?? 'reemplazo')
    d.dado_de_baja_en = new Date().toISOString()
    return responder(config, d)
  }

  /* ── Firmware / OTA (HU-46) ─────────────────────────────────── */
  if (metodo === 'get' && url === '/api/firmware/releases') {
    return responder(config, estadoDemo.firmware)
  }
  if (metodo === 'get' && url === '/api/firmware/despliegues') {
    return responder(config, [])
  }

  /* ── Sesión y privacidad (HU-44) ────────────────────────────── */
  if (metodo === 'post' && url === '/api/auth/logout') {
    return responder(config, null, 204)
  }
  if (metodo === 'post' && url.startsWith('/api/auth/privacidad/')) {
    return responder(config, { privacy_accepted: url.endsWith('aceptar'), privacy_version_accepted: '1.0' })
  }

  /* ── Usuarios y auditoría ───────────────────────────────────── */
  if (metodo === 'get' && url === '/api/usuarios') {
    return responder(config, estadoDemo.usuarios)
  }
  if (metodo === 'post' && url === '/api/usuarios') {
    const cuerpo = cuerpoJson(config)
    const email = String(cuerpo.email ?? '').toLowerCase()
    if (estadoDemo.usuarios.some((u) => u.email === email)) {
      fallar(config, 409, 'Ya existe un usuario con ese correo')
    }
    const nuevo = {
      id: `u-vivo-${Date.now()}`,
      nombre: String(cuerpo.nombre ?? ''),
      email,
      rol: (cuerpo.rol ?? 'tecnico') as Rol,
      is_active: true,
      motivo_desactivacion: null,
      desactivado_en: null,
    }
    estadoDemo.usuarios.push(nuevo)
    return responder(config, nuevo, 201)
  }
  if (metodo === 'get' && url === '/api/auditoria') {
    return responder(config, estadoDemo.auditoria.slice(0, Number(params.limite ?? 200)))
  }

  fallar(config, 404, `Ruta demo no implementada: ${metodo.toUpperCase()} ${url}`)
}
