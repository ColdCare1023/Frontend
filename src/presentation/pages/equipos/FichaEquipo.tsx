import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, useReducedMotion } from 'motion/react'
import { CalendarClock, CircleCheck, FlaskConical, History, KeyRound, MapPin, PowerOff, RefreshCw, UserRound } from 'lucide-react'

import {
  CAPACIDAD_BUFFER_LITTLEFS,
  estadoCalibracion,
  estadoCredencial,
  INTERVALO_REPORTE_POR_DEFECTO,
  umbralSilencioSegundos,
  type Dispositivo,
  type EstadoCalibracion,
} from '@/domain/entities/Dispositivo'
import { MODO_DEMO } from '@/infrastructure/demo/modoDemo'
import { fechaCorta, fechaHora } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Detalles } from '../../components/ui/detalles'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/dialog'
import { HojaInferior } from '../../components/ui/hoja-inferior'
import { useCoincideMedia } from '../../components/ui/useCoincideMedia'
import { MensajeFormulario } from '../usuarios/piezas'
import {
  CAMPO,
  datosSecundarios,
  MUELLE_FICHA,
  nombreEquipo,
  resumenSensores,
  tonoEquipo,
  useEstadoEquipo,
  useFraseCalibracion,
  vigenciaConsumida,
} from './estadoEquipo'
import { AvisosEquipo, CapasCampo, LuzSensor } from './PiezaEquipo'
import type { AccionesEquipo } from './useAccionesEquipo'

// «Por vencer» avisa (ámbar); solo la calibración vencida es crítica.
const VARIANTE_CALIBRACION: Record<EstadoCalibracion, 'ok' | 'warn' | 'critical' | 'neutral'> = {
  vigente: 'ok',
  proxima_a_vencer: 'warn',
  vencida: 'critical',
  sin_registrar: 'neutral',
}

/** Fila «etiqueta — valor» de la ficha. */
function Dato({ etiqueta, children }: { etiqueta: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-2 text-[13.5px] leading-5 last:border-b-0">
      <dt className="shrink-0 text-muted">{etiqueta}</dt>
      <dd className="nums min-w-0 text-right font-medium text-foreground [overflow-wrap:anywhere]">{children}</dd>
    </div>
  )
}

/** Un tema de la ficha, con la acción que lo edita al pie. */
function Seccion({ titulo, cabecera, accion, className, children }: { titulo: string; cabecera?: ReactNode; accion?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={cn('flex min-w-0 flex-col', className)}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[15px] leading-6 font-semibold tracking-[-0.015em] text-foreground">{titulo}</h3>
        {cabecera}
      </div>
      <div className="mt-1 flex-1">{children}</div>
      {accion && <div className="mt-2 flex flex-wrap gap-1">{accion}</div>}
    </section>
  )
}

function AccionFicha({ icono: Icono, peligro = false, ...props }: { icono: typeof MapPin; peligro?: boolean } & React.ComponentProps<typeof Button>) {
  return (
    <Button
      variant="secondary"
      size="sm"
      {...props}
      className={cn('min-w-0 whitespace-normal py-1.5 text-left', peligro && 'text-critical', props.className)}
    >
      <Icono aria-hidden />
      {props.children}
    </Button>
  )
}

/** La ficha completa: todo lo que se sabe del equipo y todo lo que se puede hacer con él. */
function ContenidoFicha({ d, a, children }: { d: Dispositivo; a: AccionesEquipo; children?: ReactNode }) {
  const { t } = useTranslation()
  const tono = tonoEquipo(d)
  const { principal, segundo } = useEstadoEquipo(d)
  const { tinta, suave } = CAMPO[tono]
  const sinDato = t('dispositivos.ficha.sinDato')
  const calibracion = estadoCalibracion(d)
  const { frase: calibracionFrase } = useFraseCalibracion(d)
  const consumida = vigenciaConsumida(d)
  const buffer = d.buffer_littlefs
  const sensores = resumenSensores(d)

  return (
    <>
      <header className={cn('relative isolate overflow-hidden px-5 pb-5 pt-6 sm:px-6 sm:pb-6 [@media(max-height:480px)]:py-4', tinta)}>
        <CapasCampo tono={tono} />
        <p className="flex flex-wrap items-center gap-x-2.5 pr-11 text-[15px] leading-6 font-semibold">
          <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-current" />
          <span>{principal}</span>
          {segundo && <span className={cn('text-[13.5px] font-medium', suave)}>· {segundo}</span>}
        </p>
        {/* El nombre primero, como en la pieza; el código en segundo plano. */}
        <p aria-hidden className="mt-6 text-[clamp(2rem,6vw,3.25rem)] leading-[1.04] font-semibold tracking-[-0.04em] [overflow-wrap:anywhere] [@media(max-height:480px)]:mt-2 [@media(max-height:480px)]:text-[28px]">
          {nombreEquipo(d)}
        </p>
        <p aria-hidden className={cn('nums mt-1.5 text-[14px] leading-5 font-medium [overflow-wrap:anywhere]', suave)}>
          {datosSecundarios(d)}
        </p>
        <p className="mt-4 text-[15px] leading-6 font-semibold">{calibracionFrase}</p>
        <AvisosEquipo d={d} className="mt-3" />
      </header>

      <div className="space-y-6 px-5 py-5 sm:px-6 sm:py-6">
        {a.mensajeFlota && (
          <MensajeFormulario mensaje={a.mensajeFlota} />
        )}

        {/* La explicación completa de cada pendiente: en táctil no hay `title` que valga. */}
        {(d.rotacion_por_compromiso || d.posesion_pendiente || d.broker_pendiente_desde) && (
          <div className="space-y-1.5 text-[13px] leading-5 text-muted">
            {d.rotacion_por_compromiso && <p>{t('dispositivos.telemetriaRetenidaAyuda')}</p>}
            {d.posesion_pendiente && <p>{t('dispositivos.posesionPendienteAyuda')}</p>}
            {d.broker_pendiente && d.broker_pendiente_desde && (
              <p className="nums">{t('dispositivos.brokerPendienteDesde', { fecha: fechaHora(d.broker_pendiente_desde) })}</p>
            )}
          </div>
        )}

        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          <Seccion
            titulo={t('dispositivos.calibracion')}
            cabecera={<Badge variant={VARIANTE_CALIBRACION[calibracion]}>{t(`dispositivos.calibracionEstado.${calibracion}`)}</Badge>}
            accion={<AccionFicha icono={CalendarClock} onClick={() => a.abrirCalibracion(d)}>{t('dispositivos.registrarCalibracion')}</AccionFicha>}
          >
            {consumida !== null && (
              <span aria-hidden className="mb-1 mt-1.5 block h-1 overflow-hidden rounded-full bg-cream-300">
                <span className="block h-full origin-left rounded-full bg-primary" style={{ transform: `scaleX(${consumida})` }} />
              </span>
            )}
            <dl>
              <Dato etiqueta={t('dispositivos.ficha.ultimaCalibracion')}>{d.fecha_ultima_calibracion ? fechaCorta(d.fecha_ultima_calibracion) : sinDato}</Dato>
              <Dato etiqueta={t('dispositivos.ficha.proximaCalibracion')}>{d.fecha_proxima_calibracion ? fechaCorta(d.fecha_proxima_calibracion) : sinDato}</Dato>
              <Dato etiqueta={t('dispositivos.ficha.certificado')}>{d.numero_certificado_calibracion || sinDato}</Dato>
              {d.observaciones_calibracion && <Dato etiqueta={t('dispositivos.observaciones')}>{d.observaciones_calibracion}</Dato>}
            </dl>
          </Seccion>

          <Seccion
            titulo={t('dispositivos.ficha.responsable')}
            accion={<AccionFicha icono={UserRound} onClick={() => a.abrirResponsable(d)}>{t('dispositivos.editarResponsable')}</AccionFicha>}
          >
            <dl>
              <Dato etiqueta={t('dispositivos.responsableNombre')}>{d.responsable_nombre || sinDato}</Dato>
              <Dato etiqueta={t('dispositivos.responsableEmail')}>{d.responsable_email || sinDato}</Dato>
              <Dato etiqueta={t('dispositivos.ficha.telefono')}>{d.responsable_telefono || sinDato}</Dato>
            </dl>
          </Seccion>

          <Seccion
            titulo={t('dispositivos.ficha.instalacion')}
            accion={<AccionFicha icono={MapPin} onClick={() => a.abrirInstalacion(d)}>{t('dispositivos.editarInstalacion')}</AccionFicha>}
          >
            <dl>
              <Dato etiqueta={t('dispositivos.ubicacion')}>{d.ubicacion || sinDato}</Dato>
              <Dato etiqueta={t('dispositivos.fechaInstalacion')}>{d.fecha_instalacion ? fechaCorta(d.fecha_instalacion) : sinDato}</Dato>
              <Dato etiqueta={t('dispositivos.ficha.instaladoPor')}>{d.instalado_por || sinDato}</Dato>
              {d.observaciones_instalacion && <Dato etiqueta={t('dispositivos.observaciones')}>{d.observaciones_instalacion}</Dato>}
            </dl>
          </Seccion>

          <Seccion
            titulo={t('dispositivos.sensores')}
            cabecera={
              <span className="nums text-[13.5px] font-medium text-muted">
                {sensores.total > 0 ? t('dispositivos.ficha.sensoresActivos', { activos: sensores.activos, total: sensores.total }) : sinDato}
              </span>
            }
          >
            <ul aria-label={t('dispositivos.sensores')}>
              {(d.sensores ?? []).map((sensor) => (
                <li key={sensor.modelo} className="flex items-center justify-between gap-3 border-b border-border py-2 text-[13.5px] leading-5 last:border-b-0">
                  <span className="flex items-center gap-2.5 font-medium text-foreground">
                    <LuzSensor
                      estado={sensor.estado}
                      className={cn(sensor.estado === 'ok' && 'text-secondary', sensor.estado === 'error' && 'text-critical-solid', sensor.estado === 'no_instalado' && 'text-faint')}
                    />
                    {sensor.modelo}
                  </span>
                  <Badge variant={sensor.estado === 'ok' ? 'ok' : sensor.estado === 'error' ? 'critical' : 'neutral'}>
                    {t(`dispositivos.sensorEstado.${sensor.estado}`)}
                  </Badge>
                </li>
              ))}
              {(d.sensores ?? []).length === 0 && <li className="py-2 text-[13.5px] text-muted">{sinDato}</li>}
            </ul>
          </Seccion>

          <Seccion
            titulo={t('dispositivos.ficha.conexion')}
            className="sm:col-span-2"
            accion={
              <>
                <AccionFicha icono={KeyRound} title={t('dispositivos.rotarCredencial')} disabled={!d.activo} onClick={() => a.abrirCredencial(d, 'rotar')}>
                  {t('dispositivos.rotarCredencial')}
                </AccionFicha>
                {d.broker_pendiente && (
                  <AccionFicha icono={CircleCheck} onClick={() => a.abrirConfirmarBroker(d)}>{t('dispositivos.confirmarBroker')}</AccionFicha>
                )}
                {d.posesion_pendiente && (
                  <AccionFicha icono={RefreshCw} title={t('dispositivos.reenviarDesafioAyuda')} disabled={a.enviando} onClick={() => void a.enviarReenviarDesafio(d)}>
                    {t('dispositivos.reenviarDesafio')}
                  </AccionFicha>
                )}
                {estadoCredencial(d) !== 'revocada' && (
                  <AccionFicha icono={PowerOff} peligro title={t('dispositivos.revocarCredencial')} onClick={() => a.abrirCredencial(d, 'revocar')}>
                    {t('dispositivos.revocarCredencial')}
                  </AccionFicha>
                )}
              </>
            }
          >
            <dl className="grid gap-x-8 sm:grid-cols-2">
              <Dato etiqueta={t('dispositivos.ficha.firmware')}>{d.firmware_version || sinDato}</Dato>
              <Dato etiqueta={t('dispositivos.ficha.captura')}>{t('dispositivos.ficha.capturaValor', { segundos: d.intervalo_reporte_segundos ?? INTERVALO_REPORTE_POR_DEFECTO })}</Dato>
              <Dato etiqueta={t('dispositivos.ficha.silencio')}>{t('dispositivos.ficha.silencioValor', { segundos: umbralSilencioSegundos(d) })}</Dato>
              <Dato etiqueta={t('dispositivos.ficha.buffer')}>{buffer?.pendientes ?? 0}</Dato>
              <Dato etiqueta={t('dispositivos.ultimoReporte')}>{d.ultimo_reporte_en ? fechaHora(d.ultimo_reporte_en) : '—'}</Dato>
              <Dato etiqueta={t('dispositivos.credencialEstado')}>{t(`dispositivos.credencial.${estadoCredencial(d)}`)}</Dato>
              <Dato etiqueta={t('dispositivos.ficha.servicio')}>
                {d.activo ? t('dispositivos.activo') : t('dispositivos.inactivo')}
              </Dato>
              {!d.activo && d.dado_de_baja_en && <Dato etiqueta={t('dispositivos.ficha.fechaBaja')}>{fechaCorta(d.dado_de_baja_en)}</Dato>}
              {!d.activo && d.descripcion_baja && <Dato etiqueta={t('dispositivos.ficha.motivoBaja')}>{d.descripcion_baja}</Dato>}
              {d.reemplaza_a_device_id && <Dato etiqueta={t('dispositivos.ficha.reemplazo')}>{d.reemplaza_a_device_id}</Dato>}
            </dl>
          </Seccion>
        </div>

        <Detalles className="border-t border-border pt-2">
          <dl className="grid gap-x-8 sm:grid-cols-2">
            {(d.sensores ?? []).map((sensor) => (
              <Dato key={sensor.modelo} etiqueta={sensor.modelo}>
                <span className="text-xs [font-family:ui-monospace,Menlo,Consolas,monospace]">{sensor.campo_telemetria}</span>
              </Dato>
            ))}
            <Dato etiqueta={t('dispositivos.ficha.bufferLocal')}>
              {buffer?.pendientes ?? 0} / {buffer?.limite ?? CAPACIDAD_BUFFER_LITTLEFS} · {t('dispositivos.perdidas', { n: buffer?.perdidas ?? 0 })}
            </Dato>
            {buffer?.desde && (
              <Dato etiqueta={t('dispositivos.ficha.periodoCola')}>
                {fechaHora(buffer.desde)} – {buffer.hasta ? fechaHora(buffer.hasta) : '—'}
              </Dato>
            )}
            {d.ultimo_evento && (
              <div className="py-2 text-[13.5px] sm:col-span-2">
                <dt className="text-muted">{t('dispositivos.ficha.telemetria')}</dt>
                <dd className="mt-1 text-xs break-all [font-family:ui-monospace,Menlo,Consolas,monospace]">
                  schema {d.ultimo_evento.schema_version} · boot_id {d.ultimo_evento.boot_id} · seq_no {d.ultimo_evento.seq_no} · {d.ultimo_evento.time_quality}
                </dd>
              </div>
            )}
          </dl>
        </Detalles>
        {children}
      </div>
    </>
  )
}

/**
 * Acciones que afectan a todo el equipo. En escritorio van fijas al pie; en un teléfono,
 * apiladas al final del cuerpo: tres botones no caben en una línea y dar de baja no debe
 * quedar a un toque por accidente.
 */
function AccionesGenerales({ d, a, apiladas = false }: { d: Dispositivo; a: AccionesEquipo; apiladas?: boolean }) {
  const { t } = useTranslation()
  const claseBoton = apiladas ? 'w-full justify-start' : undefined
  const variante = apiladas ? 'secondary' : 'ghost'
  return (
    <>
      <Button variant={variante} size="sm" className={cn(claseBoton, !apiladas && 'mr-auto px-2')} onClick={() => void a.abrirHistorial(d)}>
        <History aria-hidden />
        {t('dispositivos.historialConfiguracion')}
      </Button>
      {MODO_DEMO && (
        <Button variant={variante} size="sm" className={cn(claseBoton, !apiladas && 'px-2')} onClick={() => a.abrirSimulacion(d)}>
          <FlaskConical aria-hidden />
          {t('dispositivos.probarIoT')}
        </Button>
      )}
      {d.activo && (
        <Button variant="danger" size="sm" className={claseBoton} onClick={() => a.abrirBaja(d)}>
          <PowerOff aria-hidden />
          {t('dispositivos.darDeBaja')}
        </Button>
      )}
    </>
  )
}

/**
 * En escritorio, la ficha nace de la pieza: el panel comparte `layoutId` con ella, crece desde su
 * sitio y vuelve a él al cerrarse (solo `transform` y `opacity`). En un teléfono, la hoja inferior.
 */
export function FichaEquipo({ a }: { a: AccionesEquipo }) {
  const escritorio = useCoincideMedia('(min-width: 640px)')
  const reducir = useReducedMotion()
  const d = a.dispositivoActivo
  const abierta = a.dialogo === 'ficha' && d !== null
  const nombre = d ? nombreEquipo(d) : ''
  const descripcion = d ? datosSecundarios(d) : ''
  // El cierre va sobre el campo de color: la cápsula negra se lee sobre cualquiera de ellos.
  const cierre = '[&>button:last-child]:bg-capsula [&>button:last-child]:text-white [&>button:last-child]:hover:text-white [&>button:last-child]:shadow-(--shadow-capsula)'

  if (escritorio) {
    return (
      <Dialog open={abierta} onOpenChange={(abre) => !abre && a.cerrarFicha()}>
        <DialogContent
          className={cn(
            // El marco solo coloca: el panel visible es el que vuela desde la pieza, sin recortarlo.
            'max-h-none overflow-visible border-0 bg-transparent p-0 shadow-none sm:max-h-none sm:max-w-3xl sm:p-0',
            'data-[state=open]:animate-none data-[state=closed]:animate-none',
            '[&>button:last-child]:animate-fade',
            cierre,
          )}
        >
          <DialogTitle className="sr-only">{nombre}</DialogTitle>
          <DialogDescription className="sr-only">{descripcion}</DialogDescription>
          {d && (
            <motion.div
              layoutId={`equipo-${d.id}`}
              transition={reducir ? { duration: 0 } : MUELLE_FICHA}
              style={{ borderRadius: 20 }}
              className="flotante max-h-[85dvh] overflow-x-hidden overflow-y-auto border"
            >
              <motion.div
                initial={reducir ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.18, delay: 0.08, ease: 'easeOut' }}
              >
                <ContenidoFicha d={d} a={a} />
                <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 border-t border-border bg-surface-raised px-6 py-3">
                  <AccionesGenerales d={d} a={a} />
                </div>
              </motion.div>
            </motion.div>
          )}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <HojaInferior
      abierta={abierta}
      onCambiar={(abre) => !abre && a.cerrarFicha()}
      titulo={nombre}
      ocultarTitulo
      descripcion={descripcion}
      cuerpoClassName="p-0"
      // El asa (primer hijo) flota sobre el campo: la hoja empieza ya en el color del equipo.
      className={cn('overflow-hidden [&>div:first-child]:absolute [&>div:first-child]:inset-x-0 [&>div:first-child]:top-0 [&>div:first-child]:z-10 [&>div:first-child]:before:bg-current/40', cierre)}
    >
      {d && (
        <ContenidoFicha d={d} a={a}>
          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <AccionesGenerales d={d} a={a} apiladas />
          </div>
        </ContenidoFicha>
      )}
    </HojaInferior>
  )
}
