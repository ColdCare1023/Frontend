import { SeccionDetalle } from '@/presentation/components/ui/seccion-detalle'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarClock } from 'lucide-react'

import { estadoCalibracion, type Dispositivo } from '@/domain/entities/Dispositivo'
import { fechaDia } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { FormCalibracion } from '../../compartido/FormCalibracion'
import { Dato, MensajeFormulario, Tarjeta } from '../compartido'
import { useFlota } from '../contextoFlota'
import { CAMPOS_CALIBRACION, diasHasta } from '../estadoEquipo'
import { useCambiosEquipo } from './datosEquipo'
import { LineaTiempoCambios } from './LineaTiempoCambios'

const VARIANTE = { vigente: 'ok', proxima_a_vencer: 'warn', vencida: 'critical', sin_registrar: 'outline' } as const

/** HU-30: certificado vigente, su regla de vigencia y el registro en línea. */
export function TabCalibracion({ dispositivo, abrirRegistro }: { dispositivo: Dispositivo; abrirRegistro: boolean }) {
  const { t } = useTranslation()
  const estado = estadoCalibracion(dispositivo)
  const { registrarCalibracion } = useFlota()
  const { cambios, cargando, recargar } = useCambiosEquipo(dispositivo.id)
  const [editando, setEditando] = useState(abrirRegistro || estado === 'sin_registrar')
  const [aviso, setAviso] = useState<string | null>(null)
  const boton = useRef<HTMLButtonElement>(null)
  const dias = diasHasta(dispositivo.fecha_proxima_calibracion)
  const urgente = estado === 'vencida' || estado === 'sin_registrar'

  return (
    <div className="grid grid-cols-12 items-start gap-3 xl:gap-4">
      <Tarjeta
        id="calibracion-certificado"
        titulo={t('dispositivos.calibracionTab.certificado')}
        icono={CalendarClock}
        className="col-span-12"
        accion={
          <div className="flex items-center gap-2">
            <Badge variant={VARIANTE[estado]}>{t(`dispositivos.calibracionEstado.${estado}`)}</Badge>
            {!editando && (
              <Button
                ref={boton}
                size="sm"
                variant={urgente ? 'primary' : 'secondary'}
                onClick={() => {
                  setAviso(null)
                  setEditando(true)
                }}
              >
                {t('dispositivos.registrarCalibracion')}
              </Button>
            )}
          </div>
        }
      >
        {editando ? (
          <FormCalibracion
            dispositivo={dispositivo}
            registrar={(datos) =>
              registrarCalibracion(dispositivo.id, datos.fecha, datos.certificado, datos.observaciones, datos.vencimiento, datos.margen)
            }
            alCancelar={() => setEditando(false)}
            alGuardar={(texto) => {
              setAviso(texto)
              void recargar()
              window.setTimeout(() => {
                setEditando(false)
                requestAnimationFrame(() => boton.current?.focus())
              }, 800)
            }}
          />
        ) : (
          <>
            <p className="mt-4 flex items-baseline gap-2">
              {dias === null ? (
                <span className="text-body text-muted">{t('dispositivos.calibracionEstado.sin_registrar')}</span>
              ) : dias < 0 ? (
                <span className="text-title text-critical">{t('dispositivos.calibracionTab.vencidaHace', { dias: -dias })}</span>
              ) : (
                <>
                  <span className="nums text-metric text-foreground">{dias}</span>
                  <span className="text-body text-muted">{t('dispositivos.calibracionTab.diasRestantes')}</span>
                </>
              )}
            </p>
            <dl className="mt-2">
              <Dato etiqueta={t('dispositivos.validaHasta')}>
                <span className="nums">{dispositivo.fecha_proxima_calibracion ? fechaDia(dispositivo.fecha_proxima_calibracion) : '—'}</span>
              </Dato>
            </dl>
            <SeccionDetalle titulo={t('lectura.certificadoTecnico')} className="mt-3">
              <ReglaVigencia dispositivo={dispositivo} />
              <dl className="mt-3 grid grid-cols-1 gap-x-6 border-t border-border pt-2 sm:grid-cols-2">
                <Dato etiqueta={t('dispositivos.numeroCertificado')}>
                  <span className="codigo">{dispositivo.numero_certificado_calibracion ?? '—'}</span>
                </Dato>
                <Dato etiqueta={t('dispositivos.fechaCalibracion')}>
                  <span className="nums">{dispositivo.fecha_ultima_calibracion ? fechaDia(dispositivo.fecha_ultima_calibracion) : '—'}</span>
                </Dato>
                <Dato etiqueta={t('dispositivos.margenAviso')}>
                  <span className="nums">{dispositivo.margen_aviso_calibracion_dias ?? 30}</span>
                </Dato>
                <Dato etiqueta={t('dispositivos.observaciones')} className="sm:col-span-2">
                  {dispositivo.observaciones_calibracion || '—'}
                </Dato>
              </dl>
            </SeccionDetalle>
          </>
        )}
        {aviso && !editando && <MensajeFormulario className="mt-3" mensaje={{ tipo: 'ok', texto: aviso }} />}
      </Tarjeta>

      <SeccionDetalle titulo={t('dispositivos.calibracionTab.anteriores')} className="col-span-12">
        <LineaTiempoCambios
          cambios={cambios}
          cargando={cargando}
          campos={CAMPOS_CALIBRACION}
          vacio={`${t('dispositivos.calibracionTab.sinAnteriores')}. ${t('dispositivos.calibracionTab.queRegistrar')}`}
          className="max-h-80 overflow-y-auto"
        />
      </SeccionDetalle>
    </div>
  )
}

/** Vigencia del certificado: misma familia visual que la Regla (DIRECTION §4). */
function ReglaVigencia({ dispositivo }: { dispositivo: Dispositivo }) {
  const { t } = useTranslation()
  const inicio = dispositivo.fecha_ultima_calibracion
  const fin = dispositivo.fecha_proxima_calibracion
  if (!inicio || !fin) return null
  const a = Date.parse(inicio)
  const b = Date.parse(fin)
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return null
  const total = b - a
  const hoy = Math.min(1, Math.max(0, (Date.now() - a) / total))
  const margen = (dispositivo.margen_aviso_calibracion_dias ?? 30) * 86_400_000
  const aviso = Math.min(1, Math.max(0, (b - margen - a) / total))
  const fechaAviso = new Date(b - margen).toISOString().slice(0, 10)
  return (
    <div aria-hidden className="mt-1">
      <div className="relative h-1.5 overflow-hidden rounded-full bg-surface-sunken ring-1 ring-border ring-inset">
        <span className="absolute inset-y-0 left-0 w-full origin-left bg-banda-fuerte" style={{ transform: `scaleX(${hoy})` }} />
        <span className="absolute inset-y-0 right-0 bg-warning-100" style={{ left: `${aviso * 100}%` }} />
      </div>
      <div className="relative h-0">
        <span
          className={cn('absolute -top-2 left-0 size-2.5 -translate-x-1/2 rounded-full border-2 border-surface', hoy >= 1 ? 'bg-critical-solid' : 'bg-foreground')}
          style={{ left: `${hoy * 100}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between gap-2 text-micro text-faint">
        <span className="nums">{fechaDia(inicio)}</span>
        <span className="nums">{t('dispositivos.calibracionTab.avisoDesde', { fecha: fechaDia(fechaAviso) })}</span>
        <span className="nums">{fechaDia(fin)}</span>
      </div>
    </div>
  )
}
