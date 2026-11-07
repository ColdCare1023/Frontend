import type { Dispositivo } from '@/domain/entities/Dispositivo'
import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { RANGO_TERMICO } from '@/domain/value-objects/NivelRiesgo'

export type EstadoPanel = 'normal' | 'aviso' | 'critico' | 'sinDatos'

/** Color del campo. El estado lo decide `riesgo_efectivo`; dentro de «normal», el color solo dice dónde está la lectura. */
export type TonoCampo = 'rango' | 'frio' | 'cerca' | 'preventivo' | 'critico' | 'sinDatos'

// Un grado antes de cada límite: de lejos se ve hacia dónde va, sin cambiar la palabra del estado.
const MARGEN_DE_COLOR = 1

export function tonoDe(estado: EstadoPanel, lectura: number | null): TonoCampo {
  if (estado === 'critico') return 'critico'
  if (estado === 'aviso') return 'preventivo'
  if (estado === 'sinDatos') return 'sinDatos'
  // El color significa temperatura: sin lectura no hay nada que pintar.
  if (lectura == null || !Number.isFinite(lectura)) return 'sinDatos'
  if (lectura <= RANGO_TERMICO.minimo + MARGEN_DE_COLOR) return 'frio'
  if (lectura >= RANGO_TERMICO.maximo - MARGEN_DE_COLOR) return 'cerca'
  return 'rango'
}

// HU-33 criterio 3: `estado_sensores` distingue un sensor que falló
// (invalido/fisicamente_imposible/ausente) de uno que simplemente no aplica
// a esta lectura — un valor `null` sin más contexto es indistinguible de
// "aún no llegó el dato", que es justo la confusión que la historia pide
// evitar.
export function fallaSensor(lectura: LecturaTermica, campo: string): boolean {
  const estado = lectura.estado_sensores?.[campo]
  return estado !== undefined && estado !== null && estado !== 'valido'
}

/** Nunca redondea a 100: con una sola excursión en la ventana, «100 %» sería falso. */
export function porcentajeEnRango(enRango: number, total: number): string {
  if (enRango === total) return '100'
  const porcentaje = (enRango / total) * 100
  return porcentaje >= 99 ? (Math.floor(porcentaje * 10) / 10).toFixed(1) : String(Math.round(porcentaje))
}

/** Cada equipo muestra un medicamento distinto; el mismo equipo, siempre el mismo. */
const MEDICAMENTOS = ['vacuna', 'insulina', 'biologico', 'ampolla'] as const
export function varianteDe(deviceId: string | undefined) {
  const suma = [...(deviceId ?? '')].reduce((a, c) => a + c.charCodeAt(0), 0)
  // Los códigos suelen terminar igual: el dígito distingue mejor que la suma de todo.
  return MEDICAMENTOS[suma % MEDICAMENTOS.length]
}

/** Nodo que reportó más recientemente; null si aún no hay ninguno. */
export function equipoMasReciente(equipos: Dispositivo[]): string | null {
  const conReporte = equipos.filter((equipo) => equipo.ultimo_reporte_en)
  const candidatos = conReporte.length > 0 ? conReporte : equipos
  if (candidatos.length === 0) return null
  return [...candidatos].sort((a, b) =>
    Date.parse(b.ultimo_reporte_en ?? '') - Date.parse(a.ultimo_reporte_en ?? '') || a.id.localeCompare(b.id),
  )[0].id
}

/* ── Lo que pide atención: alimenta la frase de Inicio ── */

/** Por qué un equipo pide atención, de lo más grave a lo más leve. `ok` es lo único que permite decir «Todo en orden». */
export type CausaEquipo =
  | 'critico'
  | 'sensor'
  | 'suspendido'
  | 'silencio'
  | 'sinReporte'
  | 'sinRiesgo'
  | 'preventivo'
  | 'puerta'
  | 'ok'

const PRIORIDAD_CAUSA: Record<CausaEquipo, number> = {
  critico: 0,
  sensor: 1,
  suspendido: 2,
  silencio: 3,
  sinReporte: 4,
  sinRiesgo: 5,
  preventivo: 6,
  puerta: 7,
  ok: 8,
}

export interface ResumenEquipo {
  id: string
  nombre: string
  causa: CausaEquipo
  /** Solo con `critico` o `preventivo`: la cifra que se cita. */
  temperatura: number | null
  /** Solo con `silencio`: desde cuándo no llega nada. */
  marca: string | null
}

/**
 * La causa sale de las mismas reglas que pintan el campo: un dato viejo es «sin lectura» aunque la
 * última haya sido crítica, y el riesgo es el efectivo, no la clase cruda de la IA (HU-34). Lo que
 * el campo no pinta (sensor en falla, monitoreo suspendido, puerta abierta de más) tampoco deja
 * decir «Todo en orden».
 */
export function causaDelEquipo({
  ultima,
  equipo,
  desactualizado,
  sensorFallido,
  puertaProlongada,
}: {
  ultima: LecturaTermica | null
  equipo?: Dispositivo
  desactualizado: boolean
  sensorFallido: boolean
  puertaProlongada: boolean
}): CausaEquipo {
  if (equipo?.estado_operativo === 'MONITOREO_SUSPENDIDO') return 'suspendido'
  if (!ultima) return equipo?.ultimo_reporte_en ? 'silencio' : 'sinReporte'
  if (desactualizado) return 'silencio'
  if (sensorFallido || ultima.temperatura_interna == null || equipo?.estado_operativo === 'FALLA_SENSOR') return 'sensor'
  if (ultima.riesgo_efectivo === 'excursion_critica' || ultima.excursion_confirmada) return 'critico'
  if (!ultima.riesgo_efectivo) return 'sinRiesgo'
  if (ultima.riesgo_efectivo === 'riesgo_preventivo') return 'preventivo'
  if (puertaProlongada) return 'puerta'
  return 'ok'
}

/** Lo más grave primero; a igual causa, por nombre, para que el orden no baile. */
export function ordenarResumenes(resumenes: ResumenEquipo[]): ResumenEquipo[] {
  return [...resumenes].sort((a, b) => PRIORIDAD_CAUSA[a.causa] - PRIORIDAD_CAUSA[b.causa] || a.nombre.localeCompare(b.nombre))
}

export function mismoResumen(a: ResumenEquipo | undefined, b: ResumenEquipo): boolean {
  return a !== undefined && a.nombre === b.nombre && a.causa === b.causa && a.temperatura === b.temperatura && a.marca === b.marca
}

// Palabras en -a que son masculinas y podrían nombrar un equipo.
const MASCULINOS_EN_A = new Set(['día', 'sistema', 'mapa', 'problema', 'termostato'])

/**
 * Artículo para «Revisa la Cámara fría» o «Revisa el Refrigerador principal». Los nombres son
 * libres: se mira la primera palabra. Un código (`FARM-01-CDL`) pasa a «el equipo FARM-01-CDL».
 */
export function articuloDe(nombre: string): 'el' | 'la' | 'el equipo' {
  const primera = nombre.trim().split(/\s+/)[0] ?? ''
  if (!/^\p{L}+$/u.test(primera) || (primera.length > 1 && primera === primera.toUpperCase())) return 'el equipo'
  const palabra = primera.toLowerCase()
  if (MASCULINOS_EN_A.has(palabra)) return 'el'
  return /(a|ión|dad|tud|umbre)$/.test(palabra) ? 'la' : 'el'
}

/* ── Puerta (HU-35) ── */

// El nodo entrega su umbral configurado; 120 s cubre backends que todavía no publican el campo.
const UMBRAL_PUERTA_POR_DEFECTO = 120

export interface EstadoPuerta {
  sinDato: boolean
  abiertaAhora: boolean
  /** El backend informa cuánto lleva abierta sin cerrarse (`apertura_continua_segundos`). */
  conContinua: boolean
  continua: number | null
  umbral: number
  /** Se abrió y se cerró dentro de la ventana de muestreo. */
  huboCerrada: boolean
  duracionVentana: number | null
}

/**
 * `apertura_refrigerador` dice si HUBO apertura en la ventana de muestreo y
 * `duracion_apertura_segundos` cuánto duró dentro de ella. Lo que lleva abierta sin cerrarse viene
 * en `apertura_continua_segundos`; con backends anteriores se conserva el criterio previo.
 */
export function estadoPuerta(lectura: LecturaTermica): EstadoPuerta {
  const configurado = lectura.umbral_puerta_abierta_segundos
  const umbral = typeof configurado === 'number' && Number.isFinite(configurado) && configurado > 0 ? configurado : UMBRAL_PUERTA_POR_DEFECTO
  const conContinua = lectura.apertura_continua_segundos !== undefined
  const abiertaAhora = conContinua ? (lectura.apertura_continua_segundos ?? 0) > 0 : lectura.apertura_refrigerador === true
  return {
    sinDato: lectura.apertura_refrigerador === null,
    abiertaAhora,
    conContinua,
    continua: lectura.apertura_continua_segundos ?? null,
    umbral,
    huboCerrada: conContinua && !abiertaAhora && lectura.apertura_refrigerador === true,
    duracionVentana: lectura.duracion_apertura_segundos,
  }
}

/** Abierta más que el umbral. `transcurrido`: segundos desde la lectura mientras el dato es fresco. */
export function puertaProlongada(puerta: EstadoPuerta, transcurrido: number): boolean {
  if (puerta.conContinua) return puerta.abiertaAhora && puerta.continua != null && puerta.continua + transcurrido >= puerta.umbral
  return puerta.abiertaAhora && puerta.duracionVentana != null && puerta.duracionVentana >= puerta.umbral
}

/**
 * Lo mismo que filtra `/api/dispositivos/estado-operativo` sin `todos`: no operativo, lecturas en
 * cola o perdidas, o un incidente reciente. Así la página sondea una sola vez para ambas cosas.
 */
export function tieneIncidencias(equipo: Dispositivo): boolean {
  const buffer = equipo.buffer_littlefs
  return (
    (equipo.estado_operativo ?? 'OPERATIVO') !== 'OPERATIVO' ||
    (buffer?.pendientes ?? 0) > 0 ||
    (buffer?.perdidas ?? 0) > 0 ||
    (buffer?.brechas?.length ?? 0) > 0 ||
    (equipo.incidencias_operativas?.length ?? 0) > 0
  )
}
