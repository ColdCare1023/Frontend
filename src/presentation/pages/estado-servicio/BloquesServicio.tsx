import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Info, TriangleAlert } from 'lucide-react'

import {
  LANZADOR_REPRODUCIBLE,
  esConsumidorUnico,
  estadoMigraciones,
  modeloIARechazado,
  situacionRespaldos,
  type EstadoServicio,
} from '@/domain/entities/EstadoServicio'
import { fechaHora, haceCuanto } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { Dato } from '../../components/registros/piezas'
import { Badge } from '../../components/ui/badge'
import { IndicadorEstado } from '../../components/ui/estado'
import type { TonoEstado } from '../../components/ui/estado-tonos'

/** Tono de un bloque: color + icono + texto, nunca solo color. */
export type TonoServicio = 'ok' | 'aviso' | 'critico' | 'neutro'

type VarianteBadge = React.ComponentProps<typeof Badge>['variant']
const BADGE: Record<TonoServicio, VarianteBadge> = { ok: 'ok', aviso: 'warn', critico: 'critical', neutro: 'outline' }
const INDICADOR: Record<TonoServicio, TonoEstado> = { ok: 'normal', aviso: 'preventivo', critico: 'critico', neutro: 'neutro' }

function Insignia({ tono, children }: { tono: TonoServicio; children: ReactNode }) {
  return (
    <Badge variant={BADGE[tono]} dot={tono === 'ok'}>
      {children}
    </Badge>
  )
}

/** Valor con estado (icono de forma propia + texto). */
function Valor({ tono, children }: { tono: TonoServicio; children: string }) {
  return <IndicadorEstado tono={INDICADOR[tono]} etiqueta={children} className="text-body" />
}

/** Identificador técnico (revisión, lanzador): monoespaciado y sin cortes raros. */
function Codigo({ children }: { children: ReactNode }) {
  return <span className="codigo break-all font-mono text-meta text-subtle">{children}</span>
}

function Fecha({ iso, vacio = '—' }: { iso: string | null; vacio?: string }) {
  if (!iso) return <span className="text-muted">{vacio}</span>
  return (
    <span className="nums">
      {fechaHora(iso)}
      <span className="block text-meta text-faint">{haceCuanto(iso)}</span>
    </span>
  )
}

/** Nota del bloque: neutra (información) o de aviso (algo que revisar). */
function Nota({ tono = 'info', children }: { tono?: 'info' | 'aviso'; children: ReactNode }) {
  const Icono = tono === 'aviso' ? TriangleAlert : Info
  return (
    <p
      className={cn(
        'mt-3 flex items-start gap-2 rounded-(--radius-field) px-3 py-2 text-meta',
        tono === 'aviso' ? 'bg-warning-100 text-warning-700' : 'bg-surface-sunken text-muted',
      )}
    >
      <Icono aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  )
}

/**
 * Bloque de una dependencia: título, insignia de estado y pares
 * etiqueta/valor (`dl`). Superficie plana, sin tarjetas anidadas (DESIGN.md).
 */
export function Bloque({
  id,
  titulo,
  descripcion,
  insignia,
  className,
  children,
  pie,
}: {
  id: string
  titulo: string
  descripcion?: string
  insignia?: { tono: TonoServicio; texto: string }
  className?: string
  children: ReactNode
  pie?: ReactNode
}) {
  const idTitulo = `${id}-titulo`
  return (
    <section id={id} aria-labelledby={idTitulo} data-tono={insignia?.tono} className={cn('superficie min-w-0 p-4 xl:p-5', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={idTitulo} className="text-title text-foreground">
          {titulo}
        </h2>
        {insignia && <Insignia tono={insignia.tono}>{insignia.texto}</Insignia>}
      </div>
      {descripcion && <p className="mt-0.5 text-meta text-muted">{descripcion}</p>}
      <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">{children}</dl>
      {pie}
    </section>
  )
}

function useSiNo() {
  const { t } = useTranslation()
  return (valor: boolean) => (valor ? t('comunes.si') : t('comunes.no'))
}

export function BloqueBaseDatos({ e }: { e: EstadoServicio }) {
  const { t } = useTranslation()
  const dbOk = e.db === 'ok'
  const migraciones = estadoMigraciones(e)
  const insignia: { tono: TonoServicio; texto: string } = !dbOk
    ? { tono: 'critico', texto: t('estadoServicio.bd.conError') }
    : migraciones === 'pendientes'
      ? { tono: 'aviso', texto: t('estadoServicio.bd.migracionesPendientes') }
      : migraciones === 'al_dia'
        ? { tono: 'ok', texto: t('estadoServicio.bd.alDia') }
        : { tono: 'neutro', texto: t('estadoServicio.sinDato') }
  const tipoError = e.db?.replace(/^error:\s*/i, '') || t('estadoServicio.sinDato')
  return (
    <Bloque
      id="servicio-bd"
      titulo={t('estadoServicio.bd.titulo')}
      insignia={insignia}
      pie={
        migraciones === 'pendientes' ? (
          <Nota tono="aviso">{t('estadoServicio.bd.pendientesAyuda')}</Nota>
        ) : migraciones === 'sin_dato' ? (
          <Nota>{t('estadoServicio.bd.sinDatoAyuda')}</Nota>
        ) : null
      }
    >
      <Dato etiqueta={t('estadoServicio.bd.conexion')}>
        {dbOk ? <Valor tono="ok">{t('estadoServicio.bd.conectada')}</Valor> : <Valor tono="critico">{t('estadoServicio.bd.error', { tipo: tipoError })}</Valor>}
      </Dato>
      <Dato etiqueta={t('estadoServicio.bd.migraciones')}>
        {migraciones === 'al_dia' ? (
          <Valor tono="ok">{t('estadoServicio.bd.alDia')}</Valor>
        ) : migraciones === 'pendientes' ? (
          <Valor tono="aviso">{t('estadoServicio.bd.pendientes')}</Valor>
        ) : (
          <span className="text-muted">{t('estadoServicio.sinDato')}</span>
        )}
      </Dato>
      <Dato etiqueta={t('estadoServicio.bd.revisionAplicada')}>
        <Codigo>{e.alembic_revision ?? '—'}</Codigo>
      </Dato>
      <Dato etiqueta={t('estadoServicio.bd.revisionCodigo')}>
        <Codigo>{e.alembic_head ?? '—'}</Codigo>
      </Dato>
    </Bloque>
  )
}

export function BloqueMqtt({ e }: { e: EstadoServicio }) {
  const { t } = useTranslation()
  const siNo = useSiNo()
  const m = e.mqtt
  const insignia: { tono: TonoServicio; texto: string } = !m
    ? { tono: 'neutro', texto: t('estadoServicio.sinDato') }
    : !m.habilitado
      ? { tono: 'aviso', texto: t('estadoServicio.mqtt.deshabilitado') }
      : m.conectado
        ? { tono: 'ok', texto: t('estadoServicio.mqtt.conectado') }
        : { tono: 'critico', texto: t('estadoServicio.mqtt.desconectado') }
  const broker = e.broker_api
  return (
    <Bloque
      id="servicio-mqtt"
      titulo={t('estadoServicio.mqtt.titulo')}
      descripcion={t('estadoServicio.mqtt.descripcion')}
      insignia={insignia}
      pie={broker === 'error' ? <Nota tono="aviso">{t('estadoServicio.mqtt.brokerApiErrorAyuda')}</Nota> : null}
    >
      <Dato etiqueta={t('estadoServicio.mqtt.conexion')}>
        {m ? <Valor tono={m.conectado ? 'ok' : 'critico'}>{siNo(m.conectado)}</Valor> : '—'}
      </Dato>
      <Dato etiqueta={t('estadoServicio.mqtt.desde')}>
        <Fecha iso={m?.desde ?? null} />
      </Dato>
      <Dato etiqueta={t('estadoServicio.mqtt.tarea')}>
        {m ? (
          <Valor tono={m.tarea_activa ? 'ok' : m.habilitado ? 'critico' : 'neutro'}>
            {m.tarea_activa ? t('estadoServicio.mqtt.tareaActiva') : t('estadoServicio.mqtt.tareaDetenida')}
          </Valor>
        ) : (
          '—'
        )}
      </Dato>
      <Dato etiqueta={t('estadoServicio.mqtt.habilitado')}>{m ? siNo(m.habilitado) : '—'}</Dato>
      <Dato etiqueta={t('estadoServicio.mqtt.brokerApi')} className="sm:col-span-2">
        {broker === 'ok' ? (
          <Valor tono="ok">{t('estadoServicio.mqtt.brokerApiEstados.ok')}</Valor>
        ) : broker === 'error' ? (
          <Valor tono="critico">{t('estadoServicio.mqtt.brokerApiEstados.error')}</Valor>
        ) : broker === 'sin_configurar' ? (
          <span className="text-muted">{t('estadoServicio.mqtt.brokerApiEstados.sin_configurar')}</span>
        ) : (
          <span className="text-muted">{t('estadoServicio.sinDato')}</span>
        )}
      </Dato>
    </Bloque>
  )
}

export function BloqueArranque({ e }: { e: EstadoServicio }) {
  const { t } = useTranslation()
  const siNo = useSiNo()
  const a = e.arranque
  const unico = esConsumidorUnico(a)
  const variosWorkers = (a?.workers ?? 0) > 1
  const insignia: { tono: TonoServicio; texto: string } = unico
    ? { tono: 'ok', texto: t('estadoServicio.arranque.reproducible') }
    : variosWorkers
      ? { tono: 'critico', texto: t('estadoServicio.arranque.variosConsumidores') }
      : { tono: 'aviso', texto: t('estadoServicio.arranque.noReproducible') }
  const ayudas: string[] = []
  if (!unico) {
    if (!a) ayudas.push(t('estadoServicio.arranque.ayudaSinBloque'))
    else {
      if (!a.lanzador) ayudas.push(t('estadoServicio.arranque.ayudaSinLanzador', { lanzador: LANZADOR_REPRODUCIBLE }))
      else if (a.lanzador !== LANZADOR_REPRODUCIBLE) ayudas.push(t('estadoServicio.arranque.ayudaOtroLanzador', { actual: a.lanzador, lanzador: LANZADOR_REPRODUCIBLE }))
      if (a.workers === null) ayudas.push(t('estadoServicio.arranque.ayudaSinWorkers'))
      else if (a.workers > 1) ayudas.push(t('estadoServicio.arranque.ayudaWorkers', { n: a.workers }))
    }
  }
  return (
    <Bloque
      id="servicio-arranque"
      titulo={t('estadoServicio.arranque.titulo')}
      descripcion={t('estadoServicio.arranque.descripcion')}
      insignia={insignia}
      pie={unico ? <Nota>{t('estadoServicio.arranque.ok', { lanzador: LANZADOR_REPRODUCIBLE })}</Nota> : ayudas.map((ayuda) => <Nota key={ayuda} tono="aviso">{ayuda}</Nota>)}
    >
      <Dato etiqueta={t('estadoServicio.arranque.lanzador')}>
        {a?.lanzador ? <Codigo>{a.lanzador}</Codigo> : <span className="text-muted">{t('estadoServicio.arranque.sinLanzador')}</span>}
      </Dato>
      <Dato etiqueta={t('estadoServicio.arranque.workers')}>
        <span className={cn('nums', variosWorkers && 'font-semibold text-critical')}>{a?.workers ?? '—'}</span>
      </Dato>
      <Dato etiqueta={t('estadoServicio.arranque.consumidorUnico')} className="sm:col-span-2">
        <Valor tono={unico ? 'ok' : variosWorkers ? 'critico' : 'aviso'}>{siNo(unico)}</Valor>
      </Dato>
    </Bloque>
  )
}

export function BloqueProxy({ e }: { e: EstadoServicio }) {
  const { t } = useTranslation()
  const siNo = useSiNo()
  const p = e.proxy
  const https = p?.esquema === 'https'
  const correcto = https && p?.x_forwarded_for_presente === true && p.ip_cliente_publica !== false
  const insignia: { tono: TonoServicio; texto: string } = !p
    ? { tono: 'neutro', texto: t('estadoServicio.sinDato') }
    : correcto
      ? { tono: 'ok', texto: t('estadoServicio.proxy.correcto') }
      : { tono: 'aviso', texto: t('estadoServicio.proxy.revisar') }
  return (
    <Bloque
      id="servicio-proxy"
      titulo={t('estadoServicio.proxy.titulo')}
      descripcion={t('estadoServicio.proxy.descripcion')}
      insignia={insignia}
      pie={
        <>
          {p && !https && <Nota tono="aviso">{t('estadoServicio.proxy.ayudaHttp')}</Nota>}
          {p?.x_forwarded_for_presente === false && <Nota tono="aviso">{t('estadoServicio.proxy.ayudaSinXff')}</Nota>}
          {p?.ip_cliente_publica === false && <Nota tono="aviso">{t('estadoServicio.proxy.ayudaIpPrivada')}</Nota>}
          <Nota>{t('estadoServicio.proxy.privacidad')}</Nota>
        </>
      }
    >
      <Dato etiqueta={t('estadoServicio.proxy.esquema')}>
        {p?.esquema ? <Valor tono={https ? 'ok' : 'aviso'}>{p.esquema}</Valor> : <span className="text-muted">{t('estadoServicio.sinDato')}</span>}
      </Dato>
      <Dato etiqueta={t('estadoServicio.proxy.xff')}>
        {p?.x_forwarded_for_presente == null ? (
          <span className="text-muted">{t('estadoServicio.sinDato')}</span>
        ) : (
          <Valor tono={p.x_forwarded_for_presente ? 'ok' : 'aviso'}>{siNo(p.x_forwarded_for_presente)}</Valor>
        )}
      </Dato>
      <Dato etiqueta={t('estadoServicio.proxy.ipPublica')} className="sm:col-span-2">
        {p?.ip_cliente_publica == null ? (
          <span className="text-muted">{t('estadoServicio.proxy.noDeterminable')}</span>
        ) : (
          <Valor tono={p.ip_cliente_publica ? 'ok' : 'aviso'}>{siNo(p.ip_cliente_publica)}</Valor>
        )}
      </Dato>
    </Bloque>
  )
}

export function BloqueNotificaciones({ e }: { e: EstadoServicio }) {
  const { t } = useTranslation()
  const n = e.notificaciones
  const cola = n?.cola_pendiente ?? null
  return (
    <Bloque
      id="servicio-notificaciones"
      titulo={t('estadoServicio.notificaciones.titulo')}
      descripcion={t('estadoServicio.notificaciones.descripcion')}
      insignia={
        !n
          ? { tono: 'neutro', texto: t('estadoServicio.sinDato') }
          : n.worker_activo
            ? { tono: 'ok', texto: t('estadoServicio.notificaciones.activo') }
            : { tono: 'aviso', texto: t('estadoServicio.notificaciones.detenido') }
      }
    >
      <Dato etiqueta={t('estadoServicio.notificaciones.worker')}>
        {n ? (
          <Valor tono={n.worker_activo ? 'ok' : 'aviso'}>
            {n.worker_activo ? t('estadoServicio.notificaciones.activo') : t('estadoServicio.notificaciones.detenido')}
          </Valor>
        ) : (
          '—'
        )}
      </Dato>
      <Dato etiqueta={t('estadoServicio.notificaciones.cola')}>
        {/* Cero es neutro; solo una cola existente lleva tono de aviso (DESIGN.md). */}
        <span className={cn('nums', cola !== null && cola > 0 && 'font-semibold text-warning-700')}>{cola ?? '—'}</span>
      </Dato>
    </Bloque>
  )
}

export function BloqueVigilancia({ e }: { e: EstadoServicio }) {
  const { t } = useTranslation()
  const v = e.vigilancia_sin_datos
  return (
    <Bloque
      id="servicio-vigilancia"
      titulo={t('estadoServicio.vigilancia.titulo')}
      descripcion={t('estadoServicio.vigilancia.descripcion')}
      insignia={
        !v
          ? { tono: 'neutro', texto: t('estadoServicio.sinDato') }
          : v.activa
            ? { tono: 'ok', texto: t('estadoServicio.vigilancia.activa') }
            : { tono: 'aviso', texto: t('estadoServicio.vigilancia.detenida') }
      }
    >
      <Dato etiqueta={t('estadoServicio.vigilancia.estado')}>
        {v ? <Valor tono={v.activa ? 'ok' : 'aviso'}>{v.activa ? t('estadoServicio.vigilancia.activa') : t('estadoServicio.vigilancia.detenida')}</Valor> : '—'}
      </Dato>
      <Dato etiqueta={t('estadoServicio.vigilancia.ultimaPasada')}>
        <Fecha iso={v?.ultima_pasada ?? null} vacio={t('estadoServicio.vigilancia.sinPasada')} />
      </Dato>
    </Bloque>
  )
}

export function BloqueRespaldos({ e }: { e: EstadoServicio }) {
  const { t } = useTranslation()
  const r = e.respaldos
  const situacion = situacionRespaldos(r)
  const tono: TonoServicio = situacion === 'al_dia' ? 'ok' : situacion === 'sin_vigilancia' ? 'neutro' : 'critico'
  return (
    <Bloque
      id="servicio-respaldos"
      titulo={t('estadoServicio.respaldos.titulo')}
      descripcion={t('estadoServicio.respaldos.descripcion')}
      insignia={{ tono, texto: t(`estadoServicio.respaldos.estados.${situacion}`) }}
      pie={
        situacion === 'sin_vigilancia' ? (
          <Nota>{t('estadoServicio.respaldos.sinVigilancia')}</Nota>
        ) : situacion === 'fallido' || situacion === 'vencido' ? (
          <Nota tono="aviso">{t('estadoServicio.respaldos.alerta.accion')}</Nota>
        ) : null
      }
    >
      <Dato etiqueta={t('estadoServicio.respaldos.estado')}>
        {situacion === 'sin_vigilancia' ? (
          <span className="text-muted">{t('estadoServicio.respaldos.estados.sin_vigilancia')}</span>
        ) : (
          <Valor tono={tono}>{t(`estadoServicio.respaldos.estados.${situacion}`)}</Valor>
        )}
      </Dato>
      <Dato etiqueta={t('estadoServicio.respaldos.ultimoCompletado')}>
        <Fecha iso={r?.ultimo_completado ?? null} vacio={t('estadoServicio.respaldos.ninguno')} />
      </Dato>
      <Dato etiqueta={t('estadoServicio.respaldos.ultimaPasada')} className="sm:col-span-2">
        <Fecha iso={r?.ultima_pasada ?? null} />
      </Dato>
    </Bloque>
  )
}

/** Texto de un código de motivo con una clave por código y un genérico. */
function useMotivo() {
  const { t, i18n } = useTranslation()
  return (prefijo: string, codigo: string | null) =>
    codigo && i18n.exists(`${prefijo}.${codigo}`) ? t(`${prefijo}.${codigo}`) : t(`${prefijo}.generico`)
}

const CODIGOS_RECHAZO_LEGADO = ['checksum_invalido', 'hash_distinto_de_la_version_activa', 'sin_verificacion_de_integridad', 'incompatible', 'error_de_lectura']

/**
 * Resumen defensivo de `modelo_ia`: solo lo que el backend informa. La IA
 * preventiva apagada a propósito es neutra (no un error): el riesgo lo decide
 * la regla de 2–8 °C y el monitoreo sigue operando.
 */
export function BloqueModeloIA({ e, className }: { e: EstadoServicio; className?: string }) {
  const { t } = useTranslation()
  const motivo = useMotivo()
  const m = e.modelo_ia
  if (!m) {
    return (
      <Bloque id="servicio-modelo-ia" titulo={t('estadoServicio.modeloIA.titulo')} insignia={{ tono: 'neutro', texto: t('estadoServicio.sinDato') }} className={className}>
        <div className="sm:col-span-2">
          <dt className="sr-only">{t('estadoServicio.modeloIA.titulo')}</dt>
          <dd className="text-body text-muted">{t('estadoServicio.modeloIA.sinDato')}</dd>
        </div>
      </Bloque>
    )
  }
  const rechazado = modeloIARechazado(m)
  const p = m.preventivo
  const enUso = m.en_uso
  const iaDecide = enUso?.modelo === 'preventivo' || enUso?.modelo === 'legado' ? enUso.aprobado === true : false
  const insignia: { tono: TonoServicio; texto: string } = rechazado
    ? { tono: 'aviso', texto: t('estadoServicio.modeloIA.rechazado') }
    : iaDecide
      ? { tono: 'ok', texto: t('estadoServicio.modeloIA.enOperacion') }
      : { tono: 'neutro', texto: t('estadoServicio.modeloIA.regla') }

  let preventiva: string | null = null
  let motivoPreventiva: string | null = null
  if (p) {
    if (p.modo === 'desactivado') preventiva = t('estadoServicio.modeloIA.modosPreventivo.desactivado')
    else if (p.modo === 'sombra') preventiva = t('estadoServicio.modeloIA.modosPreventivo.sombra')
    else if (p.modo === 'activo') preventiva = p.disponible ? t('estadoServicio.modeloIA.modosPreventivo.activo') : t('estadoServicio.modeloIA.modosPreventivo.activoSinModelo')
    else preventiva = p.modo
    if (p.motivo_codigo && p.motivo_codigo !== 'modo_desactivado' && !p.disponible) motivoPreventiva = motivo('metricasIA.preventivo.motivos', p.motivo_codigo)
  }

  let decide: string | null = null
  if (enUso?.modelo === 'preventivo') decide = t('estadoServicio.modeloIA.enUso.preventivo', { version: enUso.version ?? '—' })
  else if (enUso?.modelo === 'legado') decide = t('estadoServicio.modeloIA.enUso.legado', { version: enUso.version ?? '—' })
  else if (enUso?.modelo === 'regla_2_8') decide = t('estadoServicio.modeloIA.enUso.regla_2_8')
  else if (enUso?.modelo) decide = enUso.modelo

  let legado: string
  if (m.disponible) legado = t('estadoServicio.modeloIA.legadoDisponible', { version: m.version ?? '—' })
  else if (m.motivo_codigo === 'desactivado' || m.modo_legado === 'desactivado') legado = t('estadoServicio.modeloIA.legadoDesactivado')
  else if (m.motivo_codigo && CODIGOS_RECHAZO_LEGADO.includes(m.motivo_codigo)) legado = motivo('metricasIA.modelo.rechazado.motivos', m.motivo_codigo)
  else if (m.motivo_codigo === 'no_entrenado' || m.motivo_codigo === 'sin_metricas') legado = motivo('metricasIA.modelo.no_entrenado.motivos', m.motivo_codigo)
  else legado = t('estadoServicio.modeloIA.legadoNoDisponible')

  const modoLegado = m.modo_legado_efectivo ?? m.modo_legado
  return (
    <Bloque
      id="servicio-modelo-ia"
      titulo={t('estadoServicio.modeloIA.titulo')}
      insignia={insignia}
      className={className}
      pie={
        <>
          {rechazado && <Nota tono="aviso">{t('estadoServicio.modeloIA.rechazadoAyuda')}</Nota>}
          {!iaDecide && <Nota>{t('metricasIA.modelo.continuaMonitoreo')}</Nota>}
        </>
      }
    >
      <Dato etiqueta={t('estadoServicio.modeloIA.versionActiva')}>
        {m.version_activa_registrada ? <Codigo>{m.version_activa_registrada}</Codigo> : <span className="text-muted">{t('estadoServicio.modeloIA.ninguna')}</span>}
      </Dato>
      {decide && <Dato etiqueta={t('estadoServicio.modeloIA.decide')}>{decide}</Dato>}
      {preventiva && (
        <Dato etiqueta={t('estadoServicio.modeloIA.preventiva')}>
          {p?.motivo_rechazo ? <Valor tono="aviso">{preventiva}</Valor> : preventiva}
          {motivoPreventiva && <span className="mt-0.5 block text-meta text-muted">{motivoPreventiva}</span>}
        </Dato>
      )}
      <Dato etiqueta={t('estadoServicio.modeloIA.legado')}>
        {m.motivo_rechazo ? <Valor tono="aviso">{legado}</Valor> : legado}
        {modoLegado && (
          <span className="mt-0.5 block text-meta text-muted">
            {t('estadoServicio.modeloIA.modoLegado', {
              modo: ['experimental', 'activo', 'desactivado'].includes(modoLegado) ? t(`estadoServicio.modeloIA.modosLegado.${modoLegado}`) : modoLegado,
            })}
          </span>
        )}
      </Dato>
    </Bloque>
  )
}
