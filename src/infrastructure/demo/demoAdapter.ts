import {
  AxiosError,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'

import type { AlertaTermica } from '@/domain/entities/AlertaTermica'
import type { BufferLittleFS, Dispositivo, HistorialConfiguracion, IncidenteOperativo } from '@/domain/entities/Dispositivo'
import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { MOTIVOS_DESACTIVACION, type Usuario } from '@/domain/entities/Usuario'
import type { Rol } from '@/domain/value-objects/Rol'
import { ROLES } from '@/domain/value-objects/Rol'
import {
  crearTokenDemo,
  estadoDemo,
  generarLecturaEnVivo,
  generarLecturasBuffer,
  METRICAS_IA_DEMO,
} from './datosDemo'

// Flujos que tienen estado propio del adapter durante la sesión demo.
const historialConfiguracionDemo = new Map<string, HistorialConfiguracion[]>()
const registrosAisladosDemo = new Set<string>()
const registrosCorrompidosDemo = new Set<string>()
const intentosLoginDemo = new Map<string, { cantidad: number; inicio: number; bloqueadoHasta: number }>()
let siguienteCambioDemo = 1
let cadenaComprometidaDemo = false

function registrarAuditoriaDemo(
  accion: string,
  recurso: string,
  usuarioId: string | null,
  resultado: string,
  detalle: Record<string, unknown> | null = null,
): void {
  estadoDemo.auditoria.unshift({
    id: `au-demo-${Date.now()}-${estadoDemo.auditoria.length}`,
    usuario_id: usuarioId,
    accion,
    recurso,
    detalle,
    resultado,
    ip_origen: '198.51.100.10',
    created_at: new Date().toISOString(),
  })
}

/**
 * Adapter de Axios para el modo demostración: intercepta cada request del
 * apiClient y responde con los datos simulados en memoria. Los hooks y las
 * páginas no cambian en absoluto — creen hablar con el backend real.
 */


/**
 * Compone un PDF válido en el navegador para el modo demostración.
 *
 * The demo PDF uses browser-simulated records. It must never claim a verified
 * integrity result; production report generation remains a backend concern.
 */
async function pdfDemostracion(params: Record<string, string>): Promise<Blob> {
  const desde = (params.fecha_desde ?? '').slice(0, 10)
  const hasta = (params.fecha_hasta ?? '').slice(0, 10)
  const dentroDelPeriodo = (timestamp: string | null) =>
    timestamp !== null && timestamp >= (params.fecha_desde ?? '') && timestamp <= (params.fecha_hasta ?? '\uffff')
  const coincideEquipo = (deviceId: string | null) => !params.device_id || deviceId === params.device_id
  const lecturas = estadoDemo.lecturas
    .filter((lectura) => dentroDelPeriodo(lectura.timestamp) && coincideEquipo(lectura.device_id))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  const alertas = estadoDemo.alertas
    .filter((alerta) => dentroDelPeriodo(alerta.created_at) && coincideEquipo(alerta.device_id))
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
  const trazabilidad = estadoDemo.trazabilidad
    .filter((registro) => dentroDelPeriodo(registro.timestamp) && coincideEquipo(registro.device_id))
  const alertasPorId = new Map(estadoDemo.alertas.map((alerta) => [alerta.id, alerta]))
  const acciones = estadoDemo.acciones.filter((accion) => {
    const alerta = alertasPorId.get(accion.alert_id)
    return dentroDelPeriodo(accion.created_at) && coincideEquipo(alerta?.device_id ?? null)
  })
  const temperaturas = lecturas
    .map((lectura) => lectura.temperatura_interna)
    .filter((temperatura): temperatura is number => temperatura !== null)
  const minimo = temperaturas.length ? Math.min(...temperaturas) : null
  const maximo = temperaturas.length ? Math.max(...temperaturas) : null
  const promedio = temperaturas.length
    ? temperaturas.reduce((total, temperatura) => total + temperatura, 0) / temperaturas.length
    : null

  // PDF uses WinAnsi for Helvetica. Convert text to one-byte hex strings so
  // accented Spanish labels keep valid stream lengths and cross-reference offsets.
  const extras: Record<string, number> = {
    '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87,
    'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e, '‘': 0x91,
    '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98,
    '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f,
  }
  const hex = (value: string) => `<${Array.from(value).map((char) => {
    const code = extras[char] ?? char.codePointAt(0) ?? 0x3f
    return (code <= 0xff ? code : 0x3f).toString(16).padStart(2, '0')
  }).join('')}>`
  const ops: string[] = []
  const fill = (color: string, x: number, y: number, w: number, h: number) => ops.push(`${color} rg ${x} ${y} ${w} ${h} re f`)
  const stroke = (color: string, x1: number, y1: number, x2: number, y2: number, width = 1) =>
    ops.push(`${color} RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S`)
  const text = (value: string, x: number, y: number, size = 10, color = '0.06 0.09 0.16', bold = false) => {
    ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${color} rg ${x} ${y} Td ${hex(value)} Tj ET`)
  }
  const circle = (x: number, y: number, radius: number, color: string) => {
    const c = radius * 0.55228475
    ops.push(`${color} rg ${x + radius} ${y} m ${x + radius} ${y + c} ${x + c} ${y + radius} ${x} ${y + radius} c ${x - c} ${y + radius} ${x - radius} ${y + c} ${x - radius} ${y} c ${x - radius} ${y - c} ${x - c} ${y - radius} ${x} ${y - radius} c ${x + c} ${y - radius} ${x + radius} ${y - c} ${x + radius} ${y} c f`)
  }
  const fecha = (value: string | null) => value ? value.slice(0, 16).replace('T', ' ') : '—'
  const temp = (value: number | null) => value === null ? '—' : `${value.toFixed(1)} °C`

  // Calm, branded report: clear period, measured counts, temperature context,
  // recent records, alert summary, and a truthful demo-data notice.
  fill('0.96 0.97 0.99', 0, 0, 595, 842)
  fill('0.04 0.36 1.00', 0, 830, 595, 12)
  ops.push('0.00 0.82 1.00 RG 2.5 w 1 J 45.4 781.5 m 45.4 793.7 51.4 802.1 60 802.1 c S')
  ops.push('0.04 0.36 1.00 RG 2.5 w 1 J 60 802.1 m 65.2 802.1 69.2 798.8 71.4 793.5 c S')
  ops.push('1.00 0.48 0.64 RG 2.5 w 1 J 71.4 793.5 m 73.4 789.8 74.6 785.5 74.6 781.5 c S')
  stroke('0.04 0.36 1.00', 60, 793.5, 60, 784.8, 2.4)
  circle(60, 782.5, 4.5, '0.04 0.36 1.00')
  stroke('0.00 0.82 1.00', 60, 786.5, 60, 793, 1.2)
  text('Cold', 88, 793, 18, '0.06 0.09 0.16', true)
  text('Care', 128, 793, 18, '0.04 0.36 1.00', true)
  text('MONITOREO DE CADENA DE FRÍO', 88, 778, 7.5, '0.28 0.36 0.48', true)
  fill('1.00 0.94 0.96', 437, 780, 116, 22)
  text('DEMOSTRACIÓN', 451, 788, 8, '0.56 0.16 0.30', true)

  text('INFORME DE CUMPLIMIENTO · CADENA DE FRÍO', 42, 744, 7.5, '0.04 0.36 1.00', true)
  text('Reporte de monitoreo', 42, 720, 23, '0.06 0.09 0.16', true)
  text('Resumen del periodo y evidencia térmica del dispositivo seleccionado.', 42, 699, 10, '0.28 0.36 0.48')

  fill('1 1 1', 42, 636, 511, 48)
  fill('0.04 0.36 1.00', 42, 636, 3, 48)
  text('PERIODO', 58, 665, 7.5, '0.35 0.42 0.53', true)
  text(`${desde} — ${hasta}`, 58, 648, 10, '0.06 0.09 0.16', true)
  stroke('0.85 0.89 0.94', 334, 646, 334, 674, 0.7)
  text('DISPOSITIVO', 352, 665, 7.5, '0.35 0.42 0.53', true)
  text(params.device_id || 'Todos los equipos', 352, 648, 10, '0.06 0.09 0.16', true)

  const kpis: Array<[string, number, number]> = [
    ['LECTURAS', lecturas.length, 42],
    ['ALERTAS', alertas.length, 172],
    ['ACCIONES', acciones.length, 302],
    ['TRAZABILIDAD', trazabilidad.length, 432],
  ]
  const kpiColors = ['0.04 0.36 1.00', '1.00 0.48 0.64', '0.00 0.70 0.85', '0.16 0.22 0.32']
  for (const [index, [label, value, x]] of kpis.entries()) {
    fill('1 1 1', x, 556, 121, 62)
    fill('0.85 0.89 0.94', x, 556, 121, 0.8)
    fill(kpiColors[index], x, 617, 121, 1.5)
    text(label, x + 10, 596, 6.6, '0.35 0.42 0.53', true)
    text(String(value), x + 10, 570, 19, '0.06 0.09 0.16', true)
  }

  fill('0.92 0.95 1', 42, 465, 511, 73)
  text('TEMPERATURA INTERNA', 57, 526, 7.5, '0.04 0.36 1.00', true)
  const stats: Array<[string, string, number]> = [
    ['MÍNIMA', temp(minimo), 57],
    ['PROMEDIO', temp(promedio), 224],
    ['MÁXIMA', temp(maximo), 391],
  ]
  for (const [label, value, x] of stats) {
    text(label, x, 510, 7, '0.35 0.42 0.53', true)
    text(value, x, 493, 12, '0.06 0.09 0.16', true)
  }
  const escalaX = 57
  const escalaAncho = 480
  const escalaY = 480
  fill('0.84 0.88 0.93', escalaX, escalaY, escalaAncho, 4)
  fill('0.00 0.70 0.85', escalaX + escalaAncho * 0.2, escalaY, escalaAncho * 0.6, 4)
  if (minimo !== null && maximo !== null && promedio !== null) {
    const posicion = (temperatura: number) => escalaX + escalaAncho * Math.max(0, Math.min(10, temperatura)) / 10
    stroke('0.04 0.36 1.00', posicion(minimo), escalaY - 2, posicion(maximo), escalaY - 2, 1.2)
    circle(posicion(minimo), escalaY + 2, 2.5, '0.04 0.36 1.00')
    circle(posicion(maximo), escalaY + 2, 2.5, '1.00 0.48 0.64')
    circle(posicion(promedio), escalaY + 2, 2.6, '0.06 0.09 0.16')
  }
  text('Escala 0–10 °C · rango de conservación esperado 2–8 °C', 57, 468, 6.8, '0.28 0.36 0.48')

  text('Lecturas recientes', 42, 446, 12, '0.06 0.09 0.16', true)
  text(`Mostrando ${Math.min(5, lecturas.length)} de ${lecturas.length}`, 457, 446, 8, '0.35 0.42 0.53')
  fill('0.91 0.94 0.97', 42, 420, 511, 19)
  text('FECHA Y HORA', 51, 427, 7, '0.28 0.36 0.48', true)
  text('EQUIPO', 205, 427, 7, '0.28 0.36 0.48', true)
  text('TEMP. INTERNA', 344, 427, 7, '0.28 0.36 0.48', true)
  text('RIESGO', 472, 427, 7, '0.28 0.36 0.48', true)
  const etiquetasRiesgo: Record<string, string> = {
    normal: 'Normal', riesgo_preventivo: 'Preventivo', excursion_critica: 'Crítico',
  }
  const filas = lecturas.slice(0, 5)
  if (!filas.length) {
    text('Sin lecturas registradas en este periodo.', 51, 404, 9, '0.35 0.42 0.53')
  } else {
    filas.forEach((lectura, index) => {
      const y = 393 - index * 20
      if (index % 2 === 0) fill('1 1 1', 42, y - 7, 511, 18)
      text(fecha(lectura.timestamp), 51, y, 8, '0.06 0.09 0.16')
      text(lectura.device_id, 205, y, 8, '0.06 0.09 0.16')
      text(temp(lectura.temperatura_interna), 344, y, 8, '0.06 0.09 0.16', true)
      text(etiquetasRiesgo[lectura.riesgo_efectivo ?? lectura.nivel_riesgo ?? ''] ?? 'Sin clasificar', 472, y, 7.5, '0.28 0.36 0.48')
      stroke('0.85 0.89 0.94', 42, y - 8, 553, y - 8, 0.45)
    })
  }

  const alertY = 238
  fill('1 1 1', 42, alertY, 511, 54)
  fill('1.00 0.48 0.64', 42, alertY, 3, 54)
  text('Alertas del periodo', 57, alertY + 35, 10, '0.06 0.09 0.16', true)
  text(`${alertas.length} alertas registradas`, 57, alertY + 17, 8.5, '0.28 0.36 0.48')
  if (alertas[0]) {
    const severidad = etiquetasRiesgo[alertas[0].nivel_riesgo] ?? 'Alerta'
    text(`Más reciente: ${severidad} · ${fecha(alertas[0].created_at)}`, 294, alertY + 24, 7.5, '0.35 0.20 0.28')
  } else {
    text('Sin alertas registradas en el periodo.', 294, alertY + 24, 8, '0.35 0.42 0.53')
  }

  text('Trazabilidad', 42, 210, 10, '0.06 0.09 0.16', true)
  text(`${trazabilidad.length} registros · ${acciones.length} acciones correctivas relacionadas con alertas del periodo.`, 42, 193, 8, '0.28 0.36 0.48')
  text('Integridad de registros', 42, 163, 9, '0.06 0.09 0.16', true)
  fill('1.00 0.94 0.96', 42, 130, 511, 24)
  fill('1.00 0.48 0.64', 42, 130, 3, 24)
  text('Verificación criptográfica no disponible en modo demostración.', 54, 139, 8, '0.35 0.20 0.28')

  // Report footer stamp: original ColdCare vector mark plus generated emblem,
  // with demo status explicit so it cannot be mistaken for a certified seal.
  fill('1 1 1', 42, 50, 511, 72)
  stroke('0.85 0.89 0.94', 42, 122, 553, 122, 0.8)
  fill('0.95 0.97 1', 51, 59, 54, 54)
  text('COLDCARE', 117, 96, 8, '0.04 0.36 1.00', true)
  text('REPORTE DE MONITOREO', 117, 82, 9, '0.06 0.09 0.16', true)
  text('CADENA DE FRIO · DATOS SIMULADOS', 117, 68, 7, '0.28 0.36 0.48')
  fill('1.00 0.94 0.96', 420, 78, 120, 24)
  text('SELLO VISUAL · DEMO', 430, 87, 7.2, '0.56 0.16 0.30', true)
  text('Sin validación criptográfica', 117, 56, 6.6, '0.40 0.46 0.56')

  const contenido = ops.join('\n')

  const sealResponse = await fetch(`${import.meta.env.BASE_URL}assets/coldcare-report-seal.png`)
  const sealBitmap = await createImageBitmap(await sealResponse.blob())
  const sealCanvas = document.createElement('canvas')
  sealCanvas.width = 250
  sealCanvas.height = 250
  const sealContext = sealCanvas.getContext('2d', { willReadFrequently: true })
  if (!sealContext) throw new Error('No se pudo preparar el sello visual del reporte.')
  sealContext.drawImage(sealBitmap, 0, 0, 250, 250)
  sealBitmap.close()
  const { data: sealPixels } = sealContext.getImageData(0, 0, 250, 250)
  const sealRgb = new Uint8Array(250 * 250 * 3)
  const sealAlpha = new Uint8Array(250 * 250)
  for (let source = 0, rgb = 0, alpha = 0; source < sealPixels.length; source += 4) {
    sealRgb[rgb++] = sealPixels[source]
    sealRgb[rgb++] = sealPixels[source + 1]
    sealRgb[rgb++] = sealPixels[source + 2]
    sealAlpha[alpha++] = sealPixels[source + 3]
  }
  const comprimir = async (bytes: Uint8Array) => {
    const copia = new Uint8Array(bytes.length)
    copia.set(bytes)
    const stream = new Blob([copia.buffer]).stream().pipeThrough(new CompressionStream('deflate'))
    return new Uint8Array(await new Response(stream).arrayBuffer())
  }
  const [rgbComprimido, alphaComprimido] = await Promise.all([comprimir(sealRgb), comprimir(sealAlpha)])

  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> /XObject << /Seal 7 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Type /XObject /Subtype /Image /Width 250 /Height 250 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /SMask 8 0 R /Length ${rgbComprimido.length} >>\nstream\n${String.fromCharCode(...rgbComprimido)}\nendstream`,
    `<< /Type /XObject /Subtype /Image /Width 250 /Height 250 /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${alphaComprimido.length} >>\nstream\n${String.fromCharCode(...alphaComprimido)}\nendstream`,
  ]
  const selloPdfOps = `q 52 0 0 52 52 60 cm /Seal Do Q`
  const contenidoConSello = `${contenido}\n${selloPdfOps}`
  objetos[3] = `<< /Length ${contenidoConSello.length} >>\nstream\n${contenidoConSello}\nendstream`

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

  const bytes = Uint8Array.from(pdf, (char) => char.charCodeAt(0) & 0xff)
  return new Blob([bytes], { type: 'application/pdf' })
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

function usuarioDemo(id: string): Usuario | undefined {
  return estadoDemo.usuarios.find((usuario) => usuario.id === id)
}

function dispositivoDemo(id: string): Dispositivo | undefined {
  return estadoDemo.dispositivos.find((dispositivo) => dispositivo.id === id) as
    | Dispositivo
    | undefined
}

/** Watchdog local del fake API. Evalúa silencio por última lectura, no por LWT. */
function revisarSilencioDemo(dispositivo: Dispositivo, ahora = Date.now()): void {
  if (!dispositivo.activo) return
  const ultimoReporte = dispositivo.ultimo_reporte_en ?? dispositivo.ultimo_evento?.received_at ?? null
  const referencia = ultimoReporte ?? dispositivo.registrado_en ?? null
  const timestamp = referencia ? Date.parse(referencia) : Number.NaN
  if (!Number.isFinite(timestamp)) return

  const intervalo = Math.max(1, dispositivo.intervalo_reporte_segundos ?? 30)
  const umbral = Math.max(1, dispositivo.umbral_sin_datos_segundos ?? intervalo * 3)
  const sinDatos = ahora - timestamp >= umbral * 1000
  const incidentes = estadoDemo.incidentesOperativos.filter((incidente) => incidente.device_id === dispositivo.id)
  const activo = incidentes.find((incidente) => incidente.estado === 'activo')

  if (sinDatos) {
    dispositivo.estado_operativo = 'SIN_DATOS'
    if (!activo) {
      const incidente: IncidenteOperativo = {
        id: `op-${dispositivo.id}-${timestamp}`,
        device_id: dispositivo.id,
        tipo: 'sin_datos',
        estado: 'activo',
        detectado_en: new Date(timestamp + umbral * 1000).toISOString(),
        ultimo_reporte_en: ultimoReporte ? new Date(Date.parse(ultimoReporte)).toISOString() : null,
        umbral_silencio_segundos: umbral,
        recuperado_en: null,
      }
      estadoDemo.incidentesOperativos.push(incidente)
    }
    return
  }

  if (activo) {
    activo.estado = 'resuelto'
    activo.recuperado_en = new Date(ahora).toISOString()
  }
  if (dispositivo.estado_operativo === 'SIN_DATOS' || activo) {
    const ds18b20 = dispositivo.sensores?.find((sensor) => sensor.modelo === 'DS18B20')
    dispositivo.estado_operativo = ds18b20?.estado === 'error' ? 'FALLA_SENSOR' : 'OPERATIVO'
  }
}

function sesionDemo(config: InternalAxiosRequestConfig): { sub?: unknown; email?: unknown } | null {
  const authorization = config.headers.get('Authorization')
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) return null

  try {
    const payload = authorization.slice('Bearer '.length).split('.')[1]
    if (!payload) return null
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const relleno = '='.repeat((4 - (base64.length % 4)) % 4)
    return JSON.parse(atob(base64 + relleno)) as { sub?: unknown; email?: unknown }
  } catch {
    return null
  }
}

function actorDemo(config: InternalAxiosRequestConfig): string | null {
  const actor = sesionDemo(config)?.sub
  return typeof actor === 'string' ? actor : null
}

function registrarCambioDispositivo(
  deviceId: string,
  campo: string,
  anterior: unknown,
  nuevo: unknown,
  config: InternalAxiosRequestConfig,
): void {
  if (Object.is(anterior, nuevo)) return
  const historial = historialConfiguracionDemo.get(deviceId) ?? []
  historial.unshift({
    id: `cfg-demo-${siguienteCambioDemo++}`,
    device_id: deviceId,
    campo,
    valor_anterior: anterior == null ? null : String(anterior),
    valor_nuevo: nuevo == null ? null : String(nuevo),
    actor_id: actorDemo(config),
    created_at: new Date().toISOString(),
  })
  historialConfiguracionDemo.set(deviceId, historial)
}

function cambiarCampoDispositivo(
  dispositivo: Dispositivo,
  deviceId: string,
  campo: keyof Dispositivo,
  valor: unknown,
  config: InternalAxiosRequestConfig,
): void {
  const anterior = dispositivo[campo]
  registrarCambioDispositivo(deviceId, campo, anterior, valor, config)
  Object.assign(dispositivo, { [campo]: valor })
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
    const emailNormalizado = email.trim().toLowerCase()
    const password = cuerpo.get('password') ?? ''
    const usuario = estadoDemo.usuarios.find((item) => item.email.toLowerCase() === emailNormalizado)
    const ahora = Date.now()
    const control = intentosLoginDemo.get(emailNormalizado) ?? { cantidad: 0, inicio: ahora, bloqueadoHasta: 0 }
    if (ahora >= control.inicio + 5 * 60_000 && ahora >= control.bloqueadoHasta) {
      control.cantidad = 0
      control.inicio = ahora
      intentosLoginDemo.set(emailNormalizado, control)
    }
    if (control.bloqueadoHasta > ahora) {
      registrarAuditoriaDemo('BLOQUEO_TEMPORAL', '/api/auth/login', usuario?.id ?? null, 'bloqueado')
      fallar(config, 429, 'Demasiados intentos fallidos')
    }
    if (!usuario || !usuario.is_active || password !== 'demo-2026') {
      control.cantidad += 1
      if (control.cantidad >= 5) control.bloqueadoHasta = ahora + 5 * 60_000
      intentosLoginDemo.set(emailNormalizado, control)
      registrarAuditoriaDemo('LOGIN_FALLIDO', '/api/auth/login', usuario?.id ?? null, 'fallido')
      if (control.bloqueadoHasta > ahora) {
        registrarAuditoriaDemo('BLOQUEO_TEMPORAL', '/api/auth/login', usuario?.id ?? null, 'bloqueado')
        fallar(config, 429, 'Demasiados intentos fallidos')
      }
      fallar(config, 401, 'Correo o contraseña incorrectos')
    }
    intentosLoginDemo.delete(emailNormalizado)
    registrarAuditoriaDemo('LOGIN_EXITOSO', '/api/auth/login', usuario.id, 'exitoso')
    return responder(config, {
      access_token: crearTokenDemo(email),
      token_type: 'bearer',
    })
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
    const inconsistente = [...estadoDemo.trazabilidad].find((registro) => !registrosAisladosDemo.has(registro.id) && registrosCorrompidosDemo.has(registro.id))
    return responder(config, {
      integra: !inconsistente,
      total_registros: estadoDemo.trazabilidad.filter((registro) => !registrosAisladosDemo.has(registro.id)).length,
      primer_registro_inconsistente: inconsistente ? estadoDemo.trazabilidad.indexOf(inconsistente) : null,
      detalle_inconsistencia: inconsistente ? {
        id: inconsistente.id,
        tipo_evento: inconsistente.tipo_evento,
        timestamp: inconsistente.timestamp,
        hash_esperado: `${inconsistente.hash_actual.slice(0, -1)}0`,
        hash_almacenado: inconsistente.hash_actual,
        mensaje: 'Inconsistencia simulada en datos de demostración',
      } : null,
      registros_posteriores_afectados: inconsistente ? estadoDemo.trazabilidad.length - estadoDemo.trazabilidad.indexOf(inconsistente) - 1 : 0,
    })
  }
  if (metodo === 'get' && url === '/api/trazabilidad/verificar-dispositivo') {
    const deviceId = String(params.device_id ?? '')
    const desde = String(params.desde ?? '')
    const hasta = String(params.hasta ?? '')
    const inicio = Date.parse(desde)
    const fin = Date.parse(hasta)
    if (!deviceId || !Number.isFinite(inicio) || !Number.isFinite(fin) || inicio > fin) {
      fallar(config, 422, 'El dispositivo y un periodo válido son obligatorios')
    }
    const registros = estadoDemo.trazabilidad.filter((registro) => {
      const timestamp = Date.parse(registro.timestamp)
      return (
        registro.device_id === deviceId &&
        timestamp >= inicio &&
        timestamp <= fin &&
        !registrosAisladosDemo.has(registro.id)
      )
    })
    return responder(config, {
      device_id: deviceId,
      desde,
      hasta,
      integra: true,
      total_bloques_verificados: registros.length,
      registros_del_dispositivo: registros.map(({ id, tipo_evento, timestamp }) => ({
        id,
        tipo_evento,
        timestamp,
        integro: true,
      })),
      primer_registro_inconsistente: null,
    })
  }
  if (metodo === 'post' && url === '/api/demo/trazabilidad/simular-inconsistencia') {
    const registro = estadoDemo.trazabilidad[0]
    if (!registro) fallar(config, 404, 'No hay registros de demostración')
    registrosCorrompidosDemo.add(registro.id)
    cadenaComprometidaDemo = true
    return responder(config, { simulado: true, registro_id: registro.id })
  }
  if (metodo === 'get' && url === '/api/trazabilidad') {
    let registros = [...estadoDemo.trazabilidad].reverse()
    if (params.tipo_evento) registros = registros.filter((r) => r.tipo_evento === params.tipo_evento)
    return responder(config, registros.slice(0, Number(params.limite ?? 200)))
  }
  const aislar = /^\/api\/trazabilidad\/corrupcion\/([^/]+)\/aislar$/.exec(url)
  if (metodo === 'post' && aislar) {
    const registro = estadoDemo.trazabilidad.find((r) => r.id === aislar[1])
    if (!registro) fallar(config, 404, 'Registro de trazabilidad no encontrado')
    registrosAisladosDemo.add(registro.id)
    registrosCorrompidosDemo.delete(registro.id)
    cadenaComprometidaDemo = false
    return responder(config, { registro_id: registro.id, aislado: true })
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

  /* ── Reporte BPA en PDF (HU-38) ─────────────────────────────
     Faltaba: el botón de PDF no descargaba nada en la demo. Aquí se compone
     un PDF mínimo pero VÁLIDO en el navegador. En el backend real lo genera
     ReportLab con el veredicto de integridad calculado sobre la cadena; esto
     es una muestra de la demostración y lo dice en el propio documento. */
  if (metodo === 'get' && url === '/api/reportes/bpa/pdf') {
    return responder(config, await pdfDemostracion(params) as unknown, 200)
  }

  /* ── Estado de la cadena (HU-47) ────────────────────────────── */
  if (metodo === 'get' && url === '/api/trazabilidad/estado') {
    return responder(config, { cadena_comprometida: cadenaComprometidaDemo })
  }

  /* ── Métricas del modelo (RNF-04) ───────────────────────────── */
  if (metodo === 'get' && url === '/api/ia/modelo') {
    return responder(config, METRICAS_IA_DEMO)
  }
  const detalleInferencia = /^\/api\/ia\/inferencias\/([^/]+)$/.exec(url)
  if (metodo === 'get' && detalleInferencia) {
    const lectura = estadoDemo.lecturas.find((item) => item.id === detalleInferencia[1])
    if (!lectura) fallar(config, 404, 'Lectura no encontrada')
    const clase = lectura.nivel_riesgo
    const probabilidades = clase === 'normal'
      ? { excursion_critica: 0.03, riesgo_preventivo: 0.08, normal: 0.89 }
      : clase === 'riesgo_preventivo'
        ? { excursion_critica: 0.07, riesgo_preventivo: 0.84, normal: 0.09 }
        : clase === 'excursion_critica'
          ? { excursion_critica: 0.88, riesgo_preventivo: 0.09, normal: 0.03 }
          : null
    return responder(config, {
      reading_id: lectura.id,
      model_version: lectura.modelo_version,
      inference_at: lectura.timestamp,
      inference_status: lectura.estado_inferencia,
      model_class: clase,
      probabilities: probabilidades,
      feature_vector: {
        temperatura_interna: lectura.temperatura_interna,
        temperatura_ambiental: lectura.temperatura_ambiental,
        humedad_ambiental: lectura.humedad_ambiental,
        apertura_refrigerador: lectura.apertura_refrigerador,
      },
      excursion_confirmada: lectura.excursion_confirmada,
      effective_risk: lectura.riesgo_efectivo,
      datos_simulados: true,
    })
  }

  /* ── Dispositivos (HU-30, HU-43, RF-18) ─────────────────────── */
  if (metodo === 'post' && url === '/api/dispositivos') {
    const cuerpo = cuerpoJson(config)
    const deviceId = String(cuerpo.device_id ?? '').trim()
    const nombre = String(cuerpo.nombre ?? '').trim()
    const ubicacion = String(cuerpo.ubicacion ?? '').trim()
    const modelos = Array.isArray(cuerpo.sensores) ? cuerpo.sensores.map(String) : []
    if (!/^[A-Z0-9][A-Z0-9-]{2,39}$/.test(deviceId) || !nombre || !ubicacion || !modelos.includes('DS18B20') || !modelos.includes('SHT31')) {
      fallar(config, 422, 'Use un código válido y registre nombre, ubicación, DS18B20 y SHT31')
    }
    if (estadoDemo.dispositivos.some((dispositivo) => dispositivo.id === deviceId)) {
      fallar(config, 409, 'Ya existe un equipo con ese código')
    }
    const sensores = [
      { modelo: 'DS18B20', estado: 'ok', campo_telemetria: 'temperatura_interna' },
      { modelo: 'SHT31', estado: 'ok', campo_telemetria: 'temperatura_ambiental, humedad_ambiental' },
      { modelo: 'MC-38', estado: modelos.includes('MC-38') ? 'ok' : 'no_instalado', campo_telemetria: 'apertura_refrigerador' },
    ]
    const dispositivo = {
      id: deviceId,
      nombre,
      ubicacion,
      estado_conectividad: 'sin_registrar',
      estado_operativo: 'SIN_DATOS',
      ultimo_reporte_en: null,
      registrado_en: new Date().toISOString(),
      intervalo_reporte_segundos: 30,
      umbral_sin_datos_segundos: 90,
      umbral_puerta_abierta_segundos: 120,
      sensores,
      buffer_littlefs: { pendientes: 0, limite: 128, desde: null, hasta: null, perdidas: 0 },
      ultimo_evento: null,
      estado_credencial_broker: 'pendiente',
      activo: true,
      firmware_version: 'sin_reportar',
      motivo_baja: null,
      descripcion_baja: null,
      dado_de_baja_en: null,
      reemplaza_a_device_id: null,
      fecha_ultima_calibracion: null,
      numero_certificado_calibracion: null,
      fecha_proxima_calibracion: null,
      margen_aviso_calibracion_dias: 30,
      observaciones_calibracion: null,
      fecha_instalacion: new Date().toISOString().slice(0, 10),
      instalado_por: actorDemo(config),
      observaciones_instalacion: null,
      responsable_nombre: null,
      responsable_email: null,
      responsable_telefono: null,
    }
    estadoDemo.dispositivos.push(dispositivo)
    return responder(config, dispositivo, 201)
  }
  if (metodo === 'get' && url === '/api/dispositivos') {
    // HTTP entrega arrays deserializados con identidad nueva. Snapshot evita
    // dejar memos de React apuntando al array mutable interno.
    return responder(config, estadoDemo.dispositivos.map((dispositivo) => ({ ...dispositivo })))
  }
  if (metodo === 'get' && url === '/api/dispositivos/estado-operativo') {
    const ahora = Date.now()
    const equipos = estadoDemo.dispositivos
      .map((dispositivo) => dispositivo as unknown as Dispositivo)
      .map((dispositivo) => {
        revisarSilencioDemo(dispositivo, ahora)
        return dispositivo
      })
    const eventosRecientes = estadoDemo.incidentesOperativos.filter((incidente) =>
      incidente.estado === 'activo' || ahora - Date.parse(incidente.detectado_en) < 7 * 24 * 60 * 60 * 1000,
    )
    const equiposConIncidencias = equipos.filter((dispositivo) => {
        const buffer = dispositivo.buffer_littlefs
        const tieneIncidente = eventosRecientes.some((evento) => evento.device_id === dispositivo.id)
        return dispositivo.estado_operativo !== 'OPERATIVO' ||
          (buffer?.pendientes ?? 0) > 0 ||
          (buffer?.perdidas ?? 0) > 0 ||
          (buffer?.brechas?.length ?? 0) > 0 ||
          tieneIncidente
      })
    const respuesta = equiposConIncidencias
      .map((dispositivo) => ({
        ...dispositivo,
        buffer_littlefs: dispositivo.buffer_littlefs
          ? { ...dispositivo.buffer_littlefs, brechas: [...(dispositivo.buffer_littlefs.brechas ?? [])] }
          : undefined,
        incidencias_operativas: eventosRecientes.filter((evento) => evento.device_id === dispositivo.id),
      }))
    return responder(config, respuesta)
  }
  const baja = /^\/api\/dispositivos\/([^/]+)\/baja$/.exec(url)
  if (metodo === 'post' && baja) {
    const d = estadoDemo.dispositivos.find((x) => x.id === baja[1])
    if (!d) fallar(config, 404, 'Dispositivo no encontrado')
    d.activo = false
    d.motivo_baja = String(cuerpoJson(config).motivo ?? 'reemplazo')
    d.dado_de_baja_en = new Date().toISOString()
    d.estado_credencial_broker = 'revocada'
    return responder(config, d)
  }
  const rotarCredencial = /^\/api\/dispositivos\/([^/]+)\/credencial\/rotar$/.exec(url)
  if (metodo === 'post' && rotarCredencial) {
    const dispositivo = dispositivoDemo(rotarCredencial[1])
    if (!dispositivo) fallar(config, 404, 'Dispositivo no encontrado')
    if (!dispositivo.activo) fallar(config, 409, 'El equipo está dado de baja')
    dispositivo.estado_credencial_broker = 'pendiente'
    return responder(config, {
      device_id: dispositivo.id,
      estado: 'pendiente_de_sincronizacion',
      credencial_expuesta: false,
      aplicada: false,
      demo: true,
    }, 202)
  }
  const revocarCredencial = /^\/api\/dispositivos\/([^/]+)\/credencial\/revocar$/.exec(url)
  if (metodo === 'post' && revocarCredencial) {
    const dispositivo = dispositivoDemo(revocarCredencial[1])
    if (!dispositivo) fallar(config, 404, 'Dispositivo no encontrado')
    if (!dispositivo.activo) fallar(config, 409, 'El equipo está dado de baja')
    dispositivo.estado_credencial_broker = 'revocada'
    return responder(config, { device_id: dispositivo.id, estado: 'revocada', credencial_expuesta: false, demo: true })
  }
  const simulacionIoT = /^\/api\/demo\/dispositivos\/([^/]+)\/simulacion$/.exec(url)
  if (metodo === 'post' && simulacionIoT) {
    const dispositivo = dispositivoDemo(simulacionIoT[1])
    if (!dispositivo) fallar(config, 404, 'Dispositivo no encontrado')
    const escenario = String(cuerpoJson(config).escenario ?? '')
    const cuerpoSimulacion = cuerpoJson(config)
    const sensores = (dispositivo.sensores ?? []) as Array<{ modelo: string; estado: string }>
    const buffer: BufferLittleFS = dispositivo.buffer_littlefs ?? {
      pendientes: 0,
      limite: 128,
      desde: null,
      hasta: null,
      perdidas: 0,
      brechas: [],
    }
    const ahora = Date.now()
    const momento = (milisegundos: number) => new Date(ahora - milisegundos).toISOString()
    const umbralSilencio = Number(cuerpoSimulacion.umbral_sin_datos_segundos)
    const umbralPuerta = Number(cuerpoSimulacion.umbral_puerta_abierta_segundos)
    if (Number.isFinite(umbralSilencio) && umbralSilencio >= 30 && umbralSilencio <= 600) {
      dispositivo.umbral_sin_datos_segundos = Math.round(umbralSilencio)
    }
    if (Number.isFinite(umbralPuerta) && umbralPuerta >= 30 && umbralPuerta <= 1800) {
      dispositivo.umbral_puerta_abierta_segundos = Math.round(umbralPuerta)
    }
    if (escenario === 'sin_datos') {
      // Deja MQTT en línea para mostrar que watchdog se basa en lecturas
      // recibidas y funciona incluso si el LWT no reporta desconexión.
      dispositivo.estado_conectividad = 'online'
      dispositivo.estado_operativo = 'SIN_DATOS'
      dispositivo.ultimo_reporte_en = momento((dispositivo.umbral_sin_datos_segundos ?? 90) * 1000 + 1000)
      const limiteLectura = Date.parse(dispositivo.ultimo_reporte_en)
      const desfase = ahora - limiteLectura + 2_000
      for (const lectura of estadoDemo.lecturas) {
        if (lectura.device_id !== dispositivo.id || Date.parse(lectura.timestamp) <= limiteLectura) continue
        lectura.timestamp = new Date(Date.parse(lectura.timestamp) - desfase).toISOString()
        if (lectura.captured_at) lectura.captured_at = new Date(Date.parse(lectura.captured_at) - desfase).toISOString()
        if (lectura.received_at) lectura.received_at = new Date(Date.parse(lectura.received_at) - desfase).toISOString()
      }
      buffer.pendientes = Math.max(buffer.pendientes, 3)
      buffer.desde ??= momento(180_000)
      buffer.hasta = dispositivo.ultimo_reporte_en
      revisarSilencioDemo(dispositivo, ahora)
    } else if (escenario === 'buffer_pendiente') {
      dispositivo.estado_conectividad = 'offline'
      dispositivo.estado_operativo = 'OPERATIVO'
      dispositivo.ultimo_reporte_en = momento(0)
      buffer.pendientes = 12
      buffer.desde = momento(360_000)
      buffer.hasta = momento(0)
    } else if (escenario === 'buffer_lleno') {
      dispositivo.estado_conectividad = 'offline'
      dispositivo.estado_operativo = 'OPERATIVO'
      dispositivo.ultimo_reporte_en = momento(0)
      buffer.pendientes = buffer.limite
      buffer.desde = momento(3_600_000)
      buffer.hasta = momento(0)
      buffer.perdidas += 3
      buffer.brechas = [
        ...(buffer.brechas ?? []),
        {
          desde: momento(5 * 60_000),
          hasta: momento(0),
          muestras_perdidas: 3,
          causa: 'buffer_agotado',
          registrada_en: momento(0),
        },
      ]
    } else if (escenario === 'falla_sensor') {
      const sensor = sensores.find((item) => item.modelo === 'DS18B20')
      if (sensor) sensor.estado = 'error'
      dispositivo.estado_conectividad = 'online'
      dispositivo.estado_operativo = 'FALLA_SENSOR'
      dispositivo.ultimo_reporte_en = momento(0)
      if (dispositivo.id === 'FARM-01-CDL') {
        const previa = estadoDemo.lecturas.at(-1)
        estadoDemo.lecturas.push({
          ...(previa ?? {} as LecturaTermica),
          id: `lec-falla-demo-${Date.now()}`,
          device_id: dispositivo.id,
          timestamp: momento(0),
          schema_version: 1,
          boot_id: 'demo-boot-fault-01',
          seq_no: (previa?.seq_no ?? 0) + 1,
          captured_at: momento(0),
          received_at: momento(0),
          time_quality: 'ntp',
          temperatura_interna: null,
          nivel_riesgo: null,
          riesgo_efectivo: null,
          excursion_confirmada: false,
          confianza_ia: null,
          modelo_version: null,
          origen_clasificacion: 'fallo_sensor',
          estado_inferencia: 'omitida',
          motivo_no_inferencia: 'SENSOR_FAULT',
          estado_sensores: { temperatura_interna: 'invalido', temperatura_ambiental: 'valido', humedad_ambiental: 'valido' },
        })
      }
    } else if (escenario === 'recuperar') {
      dispositivo.estado_conectividad = 'online'
      dispositivo.estado_operativo = 'OPERATIVO'
      dispositivo.ultimo_reporte_en = momento(0)
      for (const sensor of sensores) if (sensor.modelo === 'DS18B20' && sensor.estado === 'error') sensor.estado = 'ok'
      const lecturasRecuperadas = generarLecturasBuffer(
        dispositivo.id,
        buffer.desde,
        buffer.hasta,
        buffer.pendientes,
      )
      if (lecturasRecuperadas.length > 0) {
        estadoDemo.lecturas.push(...lecturasRecuperadas)
        estadoDemo.lecturas.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
      }
      buffer.pendientes = 0
      buffer.desde = null
      buffer.hasta = null
      buffer.ultima_sincronizacion_en = momento(0)
      dispositivo.ultimo_evento = {
        schema_version: '1.0',
        boot_id: `demo-recovery-${Date.now()}`,
        seq_no: Number(dispositivo.ultimo_evento?.seq_no ?? 0) + 1,
        captured_at: momento(0),
        received_at: momento(0),
        time_quality: 'ntp',
      }
      if (dispositivo.id === 'FARM-01-CDL') generarLecturaEnVivo()
    } else if (escenario === 'puerta_abierta' || escenario === 'puerta_cerrada') {
      dispositivo.estado_conectividad = 'online'
      dispositivo.ultimo_reporte_en = momento(0)
      const lectura = generarLecturaEnVivo()
      lectura.apertura_refrigerador = escenario === 'puerta_abierta'
      lectura.duracion_apertura_segundos = escenario === 'puerta_abierta' ? 240 : 0
    } else {
      fallar(config, 422, 'Escenario demo desconocido')
    }
    revisarSilencioDemo(dispositivo, Date.now())
    dispositivo.buffer_littlefs = buffer
    return responder(config, { device_id: dispositivo.id, escenario, demo: true, dispositivo: { ...dispositivo } })
  }
  const dispositivoCalibracion = /^\/api\/dispositivos\/([^/]+)\/calibracion$/.exec(url)
  if (metodo === 'patch' && dispositivoCalibracion) {
    const deviceId = dispositivoCalibracion[1]
    const dispositivo = dispositivoDemo(deviceId)
    if (!dispositivo) fallar(config, 404, 'Dispositivo no encontrado')
    const cuerpo = cuerpoJson(config)
    const fecha = String(cuerpo.fecha_calibracion ?? '')
    const certificado = String(cuerpo.numero_certificado ?? '')
    const proxima = String(cuerpo.valid_until ?? '')
    const margen = Number(cuerpo.margen_aviso_dias ?? 30)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(proxima) || !certificado.trim() || !Number.isInteger(margen) || margen < 0 || margen > 365) {
      fallar(config, 422, 'La fecha de validez, el certificado y un margen de aviso válido son obligatorios')
    }
    cambiarCampoDispositivo(dispositivo, deviceId, 'fecha_ultima_calibracion', fecha, config)
    cambiarCampoDispositivo(dispositivo, deviceId, 'numero_certificado_calibracion', certificado, config)
    cambiarCampoDispositivo(
      dispositivo,
      deviceId,
      'fecha_proxima_calibracion',
      proxima,
      config,
    )
    cambiarCampoDispositivo(dispositivo, deviceId, 'margen_aviso_calibracion_dias', margen, config)
    if (cuerpo.observaciones !== undefined) {
      cambiarCampoDispositivo(
        dispositivo,
        deviceId,
        'observaciones_calibracion',
        cuerpo.observaciones,
        config,
      )
    }
    return responder(config, dispositivo)
  }
  const dispositivoInstalacion = /^\/api\/dispositivos\/([^/]+)\/instalacion$/.exec(url)
  if (metodo === 'patch' && dispositivoInstalacion) {
    const deviceId = dispositivoInstalacion[1]
    const dispositivo = dispositivoDemo(deviceId)
    if (!dispositivo) fallar(config, 404, 'Dispositivo no encontrado')
    const cuerpo = cuerpoJson(config)
    if (cuerpo.ubicacion !== undefined) {
      cambiarCampoDispositivo(dispositivo, deviceId, 'ubicacion', cuerpo.ubicacion, config)
    }
    if (cuerpo.fecha_instalacion !== undefined) {
      cambiarCampoDispositivo(dispositivo, deviceId, 'fecha_instalacion', cuerpo.fecha_instalacion, config)
      cambiarCampoDispositivo(dispositivo, deviceId, 'instalado_por', actorDemo(config), config)
    }
    if (cuerpo.observaciones !== undefined) {
      cambiarCampoDispositivo(
        dispositivo,
        deviceId,
        'observaciones_instalacion',
        cuerpo.observaciones,
        config,
      )
    }
    return responder(config, dispositivo)
  }
  const dispositivoResponsable = /^\/api\/dispositivos\/([^/]+)\/responsable$/.exec(url)
  if (metodo === 'patch' && dispositivoResponsable) {
    const deviceId = dispositivoResponsable[1]
    const dispositivo = dispositivoDemo(deviceId)
    if (!dispositivo) fallar(config, 404, 'Dispositivo no encontrado')
    const cuerpo = cuerpoJson(config)
    const campos = [
      ['nombre', 'responsable_nombre'],
      ['email', 'responsable_email'],
      ['telefono', 'responsable_telefono'],
    ] as const
    for (const [origen, destino] of campos) {
      if (cuerpo[origen] !== undefined) {
        cambiarCampoDispositivo(dispositivo, deviceId, destino, cuerpo[origen], config)
      }
    }
    return responder(config, dispositivo)
  }
  const historialDispositivo = /^\/api\/dispositivos\/([^/]+)\/historial-configuracion$/.exec(url)
  if (metodo === 'get' && historialDispositivo) {
    const deviceId = historialDispositivo[1]
    if (!dispositivoDemo(deviceId)) fallar(config, 404, 'Dispositivo no encontrado')
    return responder(config, [...(historialConfiguracionDemo.get(deviceId) ?? [])])
  }

  /* ── Sesión ──────────────────────────────────────────────────── */
  if (metodo === 'post' && url === '/api/auth/logout') {
    return responder(config, null, 204)
  }

  /* ── Usuarios y auditoría ───────────────────────────────────── */
  if (metodo === 'get' && url === '/api/usuarios') {
    return responder(config, estadoDemo.usuarios.map((usuario) => ({ ...usuario })))
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
    estadoDemo.usuarios.unshift(nuevo)
    return responder(config, nuevo, 201)
  }
  const desactivarUsuario = /^\/api\/usuarios\/([^/]+)\/desactivar$/.exec(url)
  if (metodo === 'patch' && desactivarUsuario) {
    const usuario = usuarioDemo(desactivarUsuario[1])
    if (!usuario) fallar(config, 404, 'Usuario no encontrado')
    if (!usuario.is_active) fallar(config, 409, 'El usuario ya está desactivado')
    const motivo = String(cuerpoJson(config).motivo ?? '')
    if (!MOTIVOS_DESACTIVACION.includes(motivo as (typeof MOTIVOS_DESACTIVACION)[number])) {
      fallar(config, 422, 'Motivo de desactivación inválido')
    }
    usuario.is_active = false
    usuario.motivo_desactivacion = motivo
    usuario.desactivado_en = new Date().toISOString()
    return responder(config, usuario)
  }
  const cambiarRolUsuario = /^\/api\/usuarios\/([^/]+)\/rol$/.exec(url)
  if (metodo === 'patch' && cambiarRolUsuario) {
    const usuario = usuarioDemo(cambiarRolUsuario[1])
    if (!usuario) fallar(config, 404, 'Usuario no encontrado')
    const rol = cuerpoJson(config).rol
    if (typeof rol !== 'string' || !ROLES.includes(rol as Rol)) {
      fallar(config, 422, 'Rol inválido')
    }
    usuario.rol = rol as Rol
    return responder(config, usuario)
  }
  if (metodo === 'get' && url === '/api/auditoria') {
    let registros = [...estadoDemo.auditoria]
    if (params.accion) {
      const accion = String(params.accion).toLocaleLowerCase()
      registros = registros.filter((registro) => registro.accion.toLocaleLowerCase().includes(accion))
    }
    if (params.usuario_id) {
      registros = registros.filter((registro) => registro.usuario_id === String(params.usuario_id))
    }
    const desde = params.desde ? Date.parse(String(params.desde)) : Number.NEGATIVE_INFINITY
    const hasta = params.hasta ? Date.parse(String(params.hasta)) : Number.POSITIVE_INFINITY
    if (Number.isFinite(desde)) registros = registros.filter((registro) => Date.parse(registro.created_at) >= desde)
    if (Number.isFinite(hasta)) registros = registros.filter((registro) => Date.parse(registro.created_at) <= hasta)
    return responder(config, registros.slice(0, Number(params.limite ?? 200)))
  }

  fallar(config, 404, `Ruta demo no implementada: ${metodo.toUpperCase()} ${url}`)
}
