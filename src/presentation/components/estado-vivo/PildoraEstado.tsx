import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import * as Popover from '@radix-ui/react-popover'
import { useShallow } from 'zustand/react/shallow'
import { ArrowRight, Bell, CircleCheck, OctagonAlert, TriangleAlert } from 'lucide-react'

import { useAuthStore } from '@/application/stores/authStore'
import {
  filasEquipos,
  seleccionarFoco,
  seleccionarIncidencias,
  useEstadoVivoStore,
  type ClaveEstado,
  type FilaEquipo,
  type Tono,
} from '@/application/stores/estadoVivoStore'
import { fechaHora, haceCuanto as haceCuantoDesde, hora, localeActual } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { formatearCifra, formatearTemperatura } from '../ui/formato-cifra'
import { FONDO_ESTADO, TEXTO_ESTADO, type TonoEstado } from '../ui/estado-tonos'
import { InsigniaConteo } from '../ui/insignia-conteo'
import { Regla } from '../ui/regla'

/** Tono de la píldora → vocabulario de estado compartido. */
function tonoVisual(clave: ClaveEstado | 'sin_equipos' | 'desconocido'): TonoEstado {
  switch (clave) {
    case 'normal':
      return 'normal'
    case 'riesgo_preventivo':
      return 'preventivo'
    case 'excursion_critica':
    case 'falla_sensor':
      return 'critico'
    case 'sin_datos':
    case 'suspendido':
      return 'sin_datos'
    case 'sin_conexion':
      return 'sin_conexion'
    default:
      return 'neutro'
  }
}

/** Estado del flujo en vivo que se rotula (`estadoVivo.conexion.*`). */
type Conexion = 'conectado' | 'reconectando' | 'sinConexion' | 'demasiadasPestanas'

const TEXTO_TONO: Record<Tono, string> = {
  ok: 'text-success-700',
  aviso: 'text-warning-700',
  critico: 'text-critical',
  neutro: 'text-faint',
}

/** «hace 12 s», «hace 3 min», «hace 2 h» (Intl, sin dependencias). */
function haceCuanto(segundos: number): string {
  const formato = new Intl.RelativeTimeFormat(localeActual(), { numeric: 'always', style: 'short' })
  if (segundos < 60) return formato.format(-segundos, 'second')
  if (segundos < 3600) return formato.format(-Math.floor(segundos / 60), 'minute')
  if (segundos < 86_400) return formato.format(-Math.floor(segundos / 3600), 'hour')
  return formato.format(-Math.floor(segundos / 86_400), 'day')
}

/** Reloj de 5 s solo mientras el panel está abierto (frescura «hace X»). */
function useAhora(activo: boolean) {
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    if (!activo) return
    setAhora(Date.now())
    const id = window.setInterval(() => setAhora(Date.now()), 5_000)
    return () => window.clearInterval(id)
  }, [activo])
  return ahora
}

/**
 * Píldora de estado en vivo (DIRECTION §16, islandcn): el resumen
 * persistente del frío en la cabecera. Colapsada: punto de estado, la
 * temperatura del equipo foco, su Regla XS y el contador de alertas sin
 * atender. Al pulsarla (nunca al pasar el cursor) abre un popover de 360 px
 * con cada equipo, las alertas recientes y la hora de actualización.
 *
 * No es región viva: AvisosTiempoReal y AnuncioRiesgo siguen siendo los
 * únicos que anuncian. Los valores SSE cambian sin animar.
 */
export function PildoraEstado({ className }: { className?: string }) {
  const { t } = useTranslation()
  const [abierto, setAbierto] = useState(false)
  const { carga, conectado, motivoDesconexion, equipos, ultimas, alertas, actualizadoEn } = useEstadoVivoStore(
    useShallow((s) => ({
      carga: s.carga,
      conectado: s.conectado,
      motivoDesconexion: s.motivoDesconexion,
      equipos: s.equipos,
      ultimas: s.ultimas,
      alertas: s.alertas,
      actualizadoEn: s.actualizadoEn,
    })),
  )

  const foco = seleccionarFoco(equipos, ultimas)
  const incidencias = seleccionarIncidencias(equipos, ultimas, foco?.equipo.id ?? null)
  const clave: ClaveEstado | 'sin_equipos' | 'desconocido' =
    carga === 'error' ? 'desconocido' : carga !== 'cargando' && equipos.length === 0 ? 'sin_equipos' : foco?.estado.clave ?? 'sin_lectura'
  const tono = tonoVisual(clave)
  const temperatura = foco?.lectura?.temperatura ?? null
  const mostrarTemperatura = clave !== 'falla_sensor' && temperatura !== null

  // HU-32 esc. 3: con la cuenta en su tope de flujos se nombra la causa.
  const conexion: Conexion =
    conectado === false
      ? motivoDesconexion === 'demasiados_flujos'
        ? 'demasiadasPestanas'
        : 'sinConexion'
      : conectado
        ? 'conectado'
        : 'reconectando'
  const nombreEquipo = foco ? foco.equipo.nombre ?? foco.equipo.id : null
  const partes = [
    t('estadoVivo.titulo'),
    carga === 'cargando'
      ? t('estadoVivo.cargando')
      : nombreEquipo
        ? t('estadoVivo.sr.equipo', {
            equipo: nombreEquipo,
            valor: mostrarTemperatura ? formatearTemperatura(temperatura) : '—',
            estado: t(`estadoVivo.estado.${clave}`),
          })
        : t(`estadoVivo.estado.${clave}`),
    incidencias.cantidad > 0 ? t('estadoVivo.sr.incidencias', { count: incidencias.cantidad }) : null,
    alertas
      ? alertas.total > 0
        ? [t('estadoVivo.alertas', { count: alertas.total }), alertas.criticas > 0 ? t('estadoVivo.criticas', { count: alertas.criticas }) : null]
            .filter(Boolean)
            .join(', ')
        : t('estadoVivo.sinAlertas')
      : null,
    t(`estadoVivo.conexion.${conexion}`),
  ].filter(Boolean)

  return (
    <Popover.Root open={abierto} onOpenChange={setAbierto}>
      <Popover.Trigger asChild>
        <button
          type="button"
          data-pildora-estado
          data-tono={tono}
          aria-label={partes.join('. ')}
          aria-busy={carga === 'cargando' || undefined}
          className={cn(
            'group inline-flex h-11 min-w-0 max-w-[15rem] shrink cursor-pointer items-center gap-2 rounded-full border border-border bg-surface px-3 text-body font-medium text-foreground transition-[background-color,transform] duration-(--duration-micro) ease-(--ease-out) hover:bg-surface-hover active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[state=open]:bg-surface-hover sm:h-8 sm:max-w-none sm:pointer-coarse:h-11',
            className,
          )}
        >
          {carga === 'cargando' ? (
            <>
              <span aria-hidden className="size-2 shrink-0 rounded-full ring-1 ring-inset ring-faint" />
              <span aria-hidden className="esqueleto h-2.5 w-12 rounded-full" />
              <span aria-hidden className="esqueleto h-2.5 w-8 rounded-full" />
            </>
          ) : (
            <>
              <span aria-hidden className="relative flex size-2 shrink-0">
                <span
                  className={cn(
                    'size-2 rounded-full',
                    FONDO_ESTADO[tono],
                    conectado && tono !== 'critico' && 'pulso-vivo',
                    conectado === false && 'ring-1 ring-warning-600 ring-offset-1 ring-offset-surface',
                  )}
                />
                {tono === 'critico' && (
                  // Un solo pulso de anillo cuando el estado pasa a crítico.
                  <span key={clave} className={cn('absolute inset-0 rounded-full animate-(--animate-anillo)', FONDO_ESTADO[tono])} />
                )}
              </span>
              <span aria-hidden className={cn('nums font-semibold', !mostrarTemperatura && 'text-faint')}>
                {mostrarTemperatura ? formatearCifra(temperatura) : '—'}
                <span className="ml-0.5 text-meta font-medium text-muted max-[359px]:hidden">°C</span>
              </span>
              <Regla
                valor={mostrarTemperatura ? temperatura : null}
                tono={tono}
                tamano="xs"
                decorativa
                className="max-[359px]:hidden"
              />
              <span aria-hidden className={cn('hidden truncate text-meta font-medium md:inline', TEXTO_ESTADO[tono])}>
                {t(`estadoVivo.estado.${clave}`)}
              </span>
              {incidencias.cantidad > 0 && (
                <span aria-hidden className={cn('flex items-center gap-1', TEXTO_TONO[incidencias.tono])}>
                  <span className="h-4 w-px bg-border" />
                  <TriangleAlert className="size-3.5" />
                  <span className="nums text-meta font-semibold">{incidencias.cantidad}</span>
                </span>
              )}
              <span aria-hidden className="h-4 w-px shrink-0 bg-border" />
              <span aria-hidden className="flex items-center gap-1">
                <Bell className="size-3.5 text-faint" />
                {alertas ? (
                  <InsigniaConteo valor={alertas.total} critico={alertas.criticas > 0} truncado={alertas.truncado} mostrarCero tamano="sm" className={cn(alertas.total === 0 && 'bg-transparent text-faint')} />
                ) : (
                  <span className="text-meta text-faint">—</span>
                )}
              </span>
            </>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="center"
          sideOffset={8}
          collisionPadding={12}
          aria-label={t('estadoVivo.titulo')}
          className="flotante z-[65] w-[min(22.5rem,calc(100vw-1.5rem))] origin-(--radix-popover-content-transform-origin) rounded-(--radius-modal) p-1 text-foreground data-[state=open]:animate-(--animate-flotante-in) data-[state=closed]:animate-(--animate-pop-out)"
        >
          <PanelEstadoVivo
            abierto={abierto}
            cerrar={() => setAbierto(false)}
            filas={filasEquipos(equipos, ultimas)}
            conexion={conexion}
            actualizadoEn={actualizadoEn}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function PanelEstadoVivo({
  abierto,
  cerrar,
  filas,
  conexion,
  actualizadoEn,
}: {
  abierto: boolean
  cerrar: () => void
  filas: FilaEquipo[]
  conexion: Conexion
  actualizadoEn: number | null
}) {
  const { t } = useTranslation()
  const ahora = useAhora(abierto)
  const rol = useAuthStore((s) => s.usuario?.rol)
  const carga = useEstadoVivoStore((s) => s.carga)
  const alertas = useEstadoVivoStore((s) => s.alertas)
  const refrescar = useEstadoVivoStore((s) => s.refrescar)

  return (
    <div className="max-h-[min(80dvh,30rem)] overflow-y-auto">
      <div className="flex items-center justify-between gap-3 px-3 pt-2.5 pb-2">
        <h2 className="text-body font-semibold">{t('estadoVivo.titulo')}</h2>
        <p className={cn('flex items-center gap-1.5 text-meta', conexion === 'sinConexion' || conexion === 'demasiadasPestanas' ? 'text-warning-700' : 'text-faint')}>
          <span aria-hidden className={cn('size-1.5 rounded-full', conexion === 'conectado' ? 'bg-success-600 pulso-vivo' : conexion === 'reconectando' ? 'ring-1 ring-faint' : 'bg-warning-600')} />
          {t(`estadoVivo.conexion.${conexion}`)}
        </p>
      </div>

      <h3 className="sr-only">{t('estadoVivo.equipos')}</h3>
      {carga === 'cargando' ? (
        <div className="space-y-1 px-3 pb-2" aria-hidden>
          <div className="esqueleto h-10 rounded-(--radius-field)" />
          <div className="esqueleto h-10 rounded-(--radius-field)" />
        </div>
      ) : filas.length === 0 ? (
        <div className="flex items-center gap-3 px-3 py-2 text-body text-muted">
          <p className="flex-1">{t('estadoVivo.sinEquiposDetalle')}</p>
          {rol === 'administrador' && (
            <Link to="/dispositivos" onClick={cerrar} className="shrink-0 text-meta font-semibold text-primary-text hover:underline">
              {t('estadoVivo.registrarEquipo')}
            </Link>
          )}
        </div>
      ) : (
        <ul className="space-y-px">
          {filas.map(({ equipo, lectura, estado }) => {
            const tono = tonoVisual(estado.clave)
            const temperatura = estado.clave === 'falla_sensor' ? null : lectura?.temperatura ?? null
            const edad = lectura ? Math.max(0, Math.round((ahora - Date.parse(lectura.timestamp)) / 1000)) : null
            return (
              <li key={equipo.id}>
                <Link
                  to="/dashboard"
                  state={{ equipo: equipo.id }}
                  onClick={cerrar}
                  className="grid min-h-12 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-(--radius-field) px-3 py-2 transition-colors duration-(--duration-micro) hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <span aria-hidden className={cn('size-2 rounded-full', FONDO_ESTADO[tono])} />
                  <span className="min-w-0">
                    <span className="block truncate text-body font-medium">{equipo.nombre ?? equipo.id}</span>
                    <span className="block truncate text-meta text-faint">
                      {edad !== null
                        ? t('estadoVivo.ultimaLectura', { id: equipo.id, tiempo: haceCuanto(edad) })
                        : equipo.id}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <span className="flex items-center gap-2">
                      <Regla valor={temperatura} tono={tono} tamano="s" decorativa />
                      <span className="nums w-14 text-right text-body font-semibold">
                        {temperatura !== null ? formatearTemperatura(temperatura) : '—'}
                      </span>
                    </span>
                    <span className={cn('text-meta', TEXTO_ESTADO[tono])}>{t(`estadoVivo.estado.${estado.clave}`)}</span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      <div aria-hidden className="mx-3 my-1.5 h-px bg-border" />

      {alertas === null && carga !== 'cargando' ? (
        <p className="px-3 py-2 text-body text-muted">{t('estadoVivo.alertasError')}</p>
      ) : alertas && alertas.total === 0 ? (
        <p className="flex items-center gap-2 px-3 py-2 text-body text-muted">
          <CircleCheck aria-hidden className="size-4 text-success-700" />
          {t('estadoVivo.sinAlertas')}
        </p>
      ) : alertas ? (
        <div className="px-1">
          <div className="flex items-center gap-2 px-2 pt-1 pb-1">
            <p className="text-body font-medium">{t('estadoVivo.alertas', { count: alertas.total })}</p>
            {alertas.criticas > 0 && (
              <span className="rounded-full bg-critical-tint px-2 text-meta font-semibold text-critical">
                {t('estadoVivo.criticas', { count: alertas.criticas })}
              </span>
            )}
          </div>
          <ul className="space-y-px">
            {alertas.recientes.map((alerta) => {
              const critica = alerta.nivel_riesgo === 'excursion_critica'
              const Icono = critica ? OctagonAlert : TriangleAlert
              return (
                <li key={alerta.id} className="flex min-h-10 items-center gap-2.5 px-2 py-1.5">
                  <Icono aria-hidden className={cn('size-4 shrink-0', critica ? 'text-critical' : 'text-warning-700')} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body">{alerta.device_id}</span>
                    <span className="block truncate text-meta text-faint">
                      {t(`riesgo.${alerta.nivel_riesgo}`)}
                      {/* Relativo («ayer», «hace 3 h»): solo la hora hacía pasar por
                          de hoy una alerta de ayer. La fecha completa va en el title. */}
                      {alerta.created_at && (
                        <>
                          {' · '}
                          <time dateTime={alerta.created_at} title={fechaHora(alerta.created_at)} className="nums">
                            {haceCuantoDesde(alerta.created_at, ahora)}
                          </time>
                        </>
                      )}
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
          <Link
            to="/alertas"
            onClick={cerrar}
            className="mx-2 mt-1 mb-1 flex h-9 items-center justify-center gap-1 rounded-(--radius-field) bg-primary text-meta font-semibold text-on-primary transition-colors duration-(--duration-micro) hover:bg-primary-hover pointer-coarse:h-11"
          >
            {t('estadoVivo.verAlertas')}
            <ArrowRight aria-hidden className="size-3.5" />
          </Link>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 px-3 pt-2 pb-2 text-meta text-faint">
        {carga === 'error' || carga === 'parcial' ? (
          <>
            <span>{t('estadoVivo.error')}</span>
            <button type="button" onClick={refrescar} className="cursor-pointer font-semibold text-primary-text hover:underline">
              {t('comunes.reintentar')}
            </button>
          </>
        ) : (
          <span className="nums">{actualizadoEn ? t('estadoVivo.actualizado', { hora: hora(new Date(actualizadoEn).toISOString()) }) : null}</span>
        )}
      </div>
    </div>
  )
}
