import { METRICAS_IA_DEMO } from './datosDemo'
import { estadoPreventivoDemo, modeloNoDisponibleDemo } from './versionesModeloDemo'

/** Última revisión de Alembic del backend integrado (0042_bigint_identidad). */
const REVISION_DEMO = '0042_bigint_identidad'

/** El cron de respaldo corre a las 02:00: la última ejecución anterior a `ahora`. */
function ultimoRespaldoDemo(ahora: number): string {
  const fecha = new Date(ahora)
  fecha.setHours(2, 0, 0, 0)
  if (fecha.getTime() > ahora) fecha.setDate(fecha.getDate() - 1)
  // El pg_dump tarda unos segundos.
  return new Date(fecha.getTime() + 47_000).toISOString()
}

/**
 * `GET /health/detalle` en la demostración, con la forma del backend
 * (src/interface/main.py): servicio sano, arrancado con
 * `scripts.arrancar_api` y 1 worker, respaldos al día y sin versión activa de
 * IA. La IA preventiva aparece apagada (`IA_PREVENTIVO_MODO=desactivado`),
 * como en producción; el modelo legado sigue el estado simulado de la demo
 * (`simularModeloIADemo`): si se rechaza, el servicio pasa a «degradado».
 *
 * `ip_cliente` es una dirección de documentación (RFC 5737), no una real.
 */
export function estadoServicioDemo(ahora = Date.now()) {
  const hace = (ms: number) => new Date(ahora - ms).toISOString()
  const noDisponible = modeloNoDisponibleDemo()
  const rechazado = noDisponible?.rechazado_por_verificacion === true
  const versionActiva = estadoPreventivoDemo().version_activa_registrada
  return {
    status: rechazado ? 'degradado' : 'ok',
    timestamp: new Date(ahora).toISOString(),
    db: 'ok',
    alembic_revision: REVISION_DEMO,
    alembic_head: REVISION_DEMO,
    broker_api: 'ok',
    mqtt: { habilitado: true, tarea_activa: true, conectado: true, desde: hace(3 * 3_600_000 + 12 * 60_000) },
    notificaciones: { worker_activo: true, cola_pendiente: 0 },
    arranque: { lanzador: 'scripts.arrancar_api', workers: 1 },
    proxy: { forwarded_allow_ips: '*', esquema: 'https', ip_cliente: '203.0.113.24', x_forwarded_for_presente: true },
    vigilancia_sin_datos: { activa: true, ultima_pasada: hace(20_000) },
    respaldos: { vigilancia_activa: true, estado: null, ultimo_completado: ultimoRespaldoDemo(ahora), ultima_pasada: hace(4 * 60_000) },
    modelo_ia: {
      disponible: noDisponible === null,
      version: noDisponible === null ? METRICAS_IA_DEMO.metricas.model_version : null,
      motivo_rechazo: rechazado ? noDisponible.detail : null,
      motivo_codigo: noDisponible?.motivo ?? null,
      modo_legado: 'experimental',
      modo_legado_efectivo: 'experimental',
      preventivo: {
        modo: 'desactivado',
        motivo_rechazo: null,
        motivo_codigo: 'modo_desactivado',
        disponible: false,
        version: null,
        es_version_activa_registrada: false,
      },
      version_activa_registrada: versionActiva,
      en_uso: { modelo: 'regla_2_8', version: null, disponible: false, aprobado: false },
    },
  }
}
