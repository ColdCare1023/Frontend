import { esIpPublica } from '../value-objects/DireccionIp'

/**
 * `GET /health/detalle` (solo ADMINISTRADOR): estado de las dependencias del
 * backend tal como lo ve el operador. Evidencia de HU-12 esc. 4 (un solo
 * consumidor MQTT), HU-55 (migraciones, arranque reproducible, proxy https) y
 * HU-29 esc. 3 (respaldo programado fallido o vencido).
 *
 * La forma se normaliza de forma defensiva: un backend anterior no trae
 * `alembic_head`, `arranque`, `respaldos` ni `modelo_ia`, y `modelo_ia` cambia
 * según la versión. Lo que falta queda en `null` («no informado»), nunca se
 * inventa.
 *
 * Privacidad: del bloque `proxy` NO se conserva `ip_cliente` (es la IP
 * pública de quien consulta); solo si la IP vista es pública. Sí se conserva
 * `forwarded_allow_ips`: no es la IP de nadie, es la configuración del servidor
 * (FORWARDED_ALLOW_IPS) y el dato con que se diagnostica B-11.
 */
export type EstadoGeneralServicio = 'ok' | 'degradado'
export type EstadoBrokerApi = 'ok' | 'sin_configurar' | 'error'
export type EstadoRespaldo = 'fallido' | 'vencido'

/** Lanzador que deja `scripts/arrancar_api.py` en `COLDCARE_ARRANQUE`. */
export const LANZADOR_REPRODUCIBLE = 'scripts.arrancar_api'

export interface MqttServicio {
  habilitado: boolean
  tarea_activa: boolean
  conectado: boolean
  desde: string | null
}

export interface NotificacionesServicio {
  worker_activo: boolean
  cola_pendiente: number | null
}

export interface ArranqueServicio {
  lanzador: string | null
  workers: number | null
}

export interface ProxyServicio {
  /** FORWARDED_ALLOW_IPS del servidor (p. ej. `*` o `127.0.0.1`, su valor por omisión). */
  forwarded_allow_ips: string | null
  esquema: string | null
  x_forwarded_for_presente: boolean | null
  /** `null` si el backend no informó una IP reconocible. */
  ip_cliente_publica: boolean | null
}

export interface VigilanciaSinDatos {
  activa: boolean
  ultima_pasada: string | null
}

export interface RespaldosServicio {
  /** `null` si el backend no lo informa (versión anterior del contrato). */
  vigilancia_activa: boolean | null
  /** `null` = al día o sin nada que vigilar. */
  estado: EstadoRespaldo | null
  ultimo_completado: string | null
  ultima_pasada: string | null
}

export interface PreventivoServicio {
  modo: string | null
  disponible: boolean | null
  version: string | null
  motivo_rechazo: string | null
  motivo_codigo: string | null
}

export interface EnUsoServicio {
  /** `preventivo` | `legado` | `regla_2_8` (u otro que el backend añada). */
  modelo: string | null
  version: string | null
  aprobado: boolean | null
}

export interface ModeloIAServicio {
  /** Modelo legado (Random Forest): claves de primer nivel del backend. */
  disponible: boolean | null
  version: string | null
  motivo_rechazo: string | null
  motivo_codigo: string | null
  modo_legado: string | null
  modo_legado_efectivo: string | null
  version_activa_registrada: string | null
  preventivo: PreventivoServicio | null
  en_uso: EnUsoServicio | null
}

export interface EstadoServicio {
  status: EstadoGeneralServicio
  timestamp: string | null
  /** `ok` o `error: <Tipo>`. */
  db: string | null
  alembic_revision: string | null
  alembic_head: string | null
  broker_api: EstadoBrokerApi | null
  mqtt: MqttServicio | null
  notificaciones: NotificacionesServicio | null
  arranque: ArranqueServicio | null
  proxy: ProxyServicio | null
  vigilancia_sin_datos: VigilanciaSinDatos | null
  respaldos: RespaldosServicio | null
  modelo_ia: ModeloIAServicio | null
}

type Crudo = Record<string, unknown>

const objeto = (v: unknown): Crudo | null => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Crudo) : null)
const texto = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null)
const booleano = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null)
const entero = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

function normalizarModeloIA(crudo: unknown): ModeloIAServicio | null {
  const m = objeto(crudo)
  if (!m) return null
  const p = objeto(m.preventivo)
  const u = objeto(m.en_uso)
  return {
    disponible: booleano(m.disponible),
    version: texto(m.version),
    motivo_rechazo: texto(m.motivo_rechazo),
    motivo_codigo: texto(m.motivo_codigo),
    modo_legado: texto(m.modo_legado),
    modo_legado_efectivo: texto(m.modo_legado_efectivo),
    version_activa_registrada: texto(m.version_activa_registrada),
    preventivo: p
      ? {
          modo: texto(p.modo),
          disponible: booleano(p.disponible),
          version: texto(p.version),
          motivo_rechazo: texto(p.motivo_rechazo),
          motivo_codigo: texto(p.motivo_codigo),
        }
      : null,
    en_uso: u ? { modelo: texto(u.modelo), version: texto(u.version), aprobado: booleano(u.aprobado) } : null,
  }
}

/**
 * Respuesta cruda → estado de la pantalla. `null` si no es un estado de
 * servicio reconocible (sin `status`): la pantalla lo trata como vacío.
 */
export function normalizarEstadoServicio(crudo: unknown): EstadoServicio | null {
  const r = objeto(crudo)
  const status = texto(r?.status)
  if (!r || !status) return null

  const mqtt = objeto(r.mqtt)
  const notificaciones = objeto(r.notificaciones)
  const arranque = objeto(r.arranque)
  const proxy = objeto(r.proxy)
  const vigilancia = objeto(r.vigilancia_sin_datos)
  const respaldos = objeto(r.respaldos)
  const broker = texto(r.broker_api)
  const estadoRespaldo = texto(respaldos?.estado)

  return {
    // Un valor desconocido no se presenta como «ok».
    status: status === 'ok' ? 'ok' : 'degradado',
    timestamp: texto(r.timestamp),
    db: texto(r.db),
    alembic_revision: texto(r.alembic_revision),
    alembic_head: texto(r.alembic_head),
    broker_api: broker === 'ok' || broker === 'sin_configurar' || broker === 'error' ? broker : null,
    mqtt: mqtt
      ? {
          habilitado: mqtt.habilitado === true,
          tarea_activa: mqtt.tarea_activa === true,
          conectado: mqtt.conectado === true,
          desde: texto(mqtt.desde),
        }
      : null,
    notificaciones: notificaciones
      ? { worker_activo: notificaciones.worker_activo === true, cola_pendiente: entero(notificaciones.cola_pendiente) }
      : null,
    arranque: arranque ? { lanzador: texto(arranque.lanzador), workers: entero(arranque.workers) } : null,
    // Sin `ip_cliente`: no sale de aquí.
    proxy: proxy
      ? {
          forwarded_allow_ips: texto(proxy.forwarded_allow_ips),
          esquema: texto(proxy.esquema),
          x_forwarded_for_presente: booleano(proxy.x_forwarded_for_presente),
          ip_cliente_publica: esIpPublica(proxy.ip_cliente),
        }
      : null,
    vigilancia_sin_datos: vigilancia ? { activa: vigilancia.activa === true, ultima_pasada: texto(vigilancia.ultima_pasada) } : null,
    respaldos: respaldos
      ? {
          vigilancia_activa: booleano(respaldos.vigilancia_activa),
          estado: estadoRespaldo === 'fallido' || estadoRespaldo === 'vencido' ? estadoRespaldo : null,
          ultimo_completado: texto(respaldos.ultimo_completado),
          ultima_pasada: texto(respaldos.ultima_pasada),
        }
      : null,
    modelo_ia: normalizarModeloIA(r.modelo_ia),
  }
}

export const baseDeDatosOk = (e: EstadoServicio) => e.db === 'ok'

/** HU-55 esc. 1: `al_dia` si la revisión aplicada es la cabeza del código desplegado. */
export function estadoMigraciones(e: EstadoServicio): 'al_dia' | 'pendientes' | 'sin_dato' {
  if (!e.alembic_revision || !e.alembic_head) return 'sin_dato'
  return e.alembic_revision === e.alembic_head ? 'al_dia' : 'pendientes'
}

/**
 * HU-12 esc. 4 / HU-55: un solo consumidor MQTT solo si el proceso arrancó con
 * el lanzador reproducible y exactamente 1 worker. Con varios workers cada uno
 * abriría su propia suscripción y procesaría la misma telemetría.
 */
export function esConsumidorUnico(arranque: ArranqueServicio | null): boolean {
  return arranque?.lanzador === LANZADOR_REPRODUCIBLE && arranque.workers === 1
}

export type SituacionRespaldos = EstadoRespaldo | 'al_dia' | 'sin_vigilancia' | 'sin_pasada' | 'sin_respaldos'

/**
 * HU-29 esc. 3: vigilancia del respaldo programado. Para el backend
 * (`VigilanteRespaldos.ejecutar_una_vez`) `estado: null` es «al día **o sin
 * nada que vigilar**»; aquí solo es «al día» si hay prueba de ello:
 * - `sin_pasada`: el vigilante aún no completó ninguna revisión (recién
 *   arrancado, o su primera pasada lanzó una excepción);
 * - `sin_respaldos`: revisó y no hay ningún respaldo completado. Con
 *   `estado: null` eso solo ocurre con RESPALDO_MAX_ANTIGUEDAD_HORAS = 0 (su
 *   valor por omisión), que no avisa si el cron nunca corrió.
 */
export function situacionRespaldos(r: RespaldosServicio | null): SituacionRespaldos {
  if (r?.estado) return r.estado
  if (!r || r.vigilancia_activa === false) return 'sin_vigilancia'
  if (!r.ultima_pasada) return 'sin_pasada'
  if (!r.ultimo_completado) return 'sin_respaldos'
  return 'al_dia'
}

/** Un artefacto de IA rechazado (alterado o distinto del aprobado) degrada el servicio. */
export function modeloIARechazado(m: ModeloIAServicio | null): boolean {
  return Boolean(m && (m.motivo_rechazo || m.preventivo?.motivo_rechazo))
}

/**
 * Por qué el backend dijo «degradado», con su misma regla (main.py): base de
 * datos con error, API del broker con error o modelo de IA rechazado.
 */
export function motivosDegradado(e: EstadoServicio): Array<'db' | 'broker_api' | 'modelo_ia'> {
  const motivos: Array<'db' | 'broker_api' | 'modelo_ia'> = []
  if (!baseDeDatosOk(e)) motivos.push('db')
  if (e.broker_api === 'error') motivos.push('broker_api')
  if (modeloIARechazado(e.modelo_ia)) motivos.push('modelo_ia')
  return motivos
}
