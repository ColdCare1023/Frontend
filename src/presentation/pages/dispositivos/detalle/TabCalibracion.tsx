import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarClock, History } from 'lucide-react'

import { estadoCalibracion, type Dispositivo } from '@/domain/entities/Dispositivo'
import { fechaCorta } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Input, Label, Textarea } from '../../../components/ui/input'
import { SelectorFecha } from '../../../components/ui/selector-fecha'
import { Dato, MensajeFormulario, PieFormulario, Tarjeta, type Mensaje } from '../compartido'
import { useFlota } from '../contextoFlota'
import { CAMPOS_CALIBRACION, diasHasta } from '../estadoEquipo'
import { useCambiosEquipo } from './datosEquipo'
import { LineaTiempoCambios } from './LineaTiempoCambios'

const VARIANTE = { vigente: 'ok', proxima_a_vencer: 'warn', vencida: 'critical', sin_registrar: 'outline' } as const

/** HU-30: certificado vigente, su regla de vigencia y el registro en línea. */
export function TabCalibracion({ dispositivo, abrirRegistro }: { dispositivo: Dispositivo; abrirRegistro: boolean }) {
  const { t } = useTranslation()
  const estado = estadoCalibracion(dispositivo)
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
        className="col-span-12 lg:col-span-7"
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
            <ReglaVigencia dispositivo={dispositivo} />
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
            <dl className="mt-3 grid grid-cols-1 gap-x-6 border-t border-border pt-2 sm:grid-cols-2">
              <Dato etiqueta={t('dispositivos.numeroCertificado')}>
                <span className="codigo">{dispositivo.numero_certificado_calibracion ?? '—'}</span>
              </Dato>
              <Dato etiqueta={t('dispositivos.fechaCalibracion')}>
                <span className="nums">{dispositivo.fecha_ultima_calibracion ? fechaCorta(dispositivo.fecha_ultima_calibracion) : '—'}</span>
              </Dato>
              <Dato etiqueta={t('dispositivos.validaHasta')}>
                <span className="nums">{dispositivo.fecha_proxima_calibracion ? fechaCorta(dispositivo.fecha_proxima_calibracion) : '—'}</span>
              </Dato>
              <Dato etiqueta={t('dispositivos.margenAviso')}>
                <span className="nums">{dispositivo.margen_aviso_calibracion_dias ?? 30}</span>
              </Dato>
              <Dato etiqueta={t('dispositivos.observaciones')} className="sm:col-span-2">
                {dispositivo.observaciones_calibracion || '—'}
              </Dato>
            </dl>
          </>
        )}
        {aviso && !editando && <MensajeFormulario className="mt-3" mensaje={{ tipo: 'ok', texto: aviso }} />}
      </Tarjeta>

      <Tarjeta
        id="calibracion-anteriores"
        titulo={t('dispositivos.calibracionTab.anteriores')}
        icono={History}
        className="col-span-12 lg:col-span-5"
      >
        <LineaTiempoCambios
          cambios={cambios}
          cargando={cargando}
          campos={CAMPOS_CALIBRACION}
          vacio={`${t('dispositivos.calibracionTab.sinAnteriores')}. ${t('dispositivos.calibracionTab.queRegistrar')}`}
          className="max-h-80 overflow-y-auto"
        />
      </Tarjeta>
    </div>
  )
}

/** Misma validación y misma llamada que el diálogo anterior (HU-30, B-12). */
function FormCalibracion({
  dispositivo,
  alCancelar,
  alGuardar,
}: {
  dispositivo: Dispositivo
  alCancelar: () => void
  alGuardar: (texto: string) => void
}) {
  const { t } = useTranslation()
  const { registrarCalibracion } = useFlota()
  const [form, setForm] = useState({
    fecha: '',
    certificado: dispositivo.numero_certificado_calibracion ?? '',
    vencimiento: '',
    margen: String(dispositivo.margen_aviso_calibracion_dias ?? 30),
    observaciones: dispositivo.observaciones_calibracion ?? '',
  })
  // El selector de fecha no tiene `required` nativo: la fecha vacía se marca aquí.
  const [fechaInvalida, setFechaInvalida] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState<Mensaje>(null)

  useEffect(() => {
    document.getElementById('c-fecha')?.focus()
  }, [])

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault()
    if (!form.fecha) {
      setFechaInvalida(true)
      document.getElementById('c-fecha')?.focus()
      return
    }
    if (!form.certificado) return
    if (!(form.vencimiento > form.fecha)) {
      setMensaje({ tipo: 'error', texto: t('dispositivos.vencimientoInvalido') })
      return
    }
    setEnviando(true)
    setMensaje(null)
    const resultado = await registrarCalibracion(
      dispositivo.id,
      form.fecha,
      form.certificado,
      form.observaciones,
      form.vencimiento,
      Number(form.margen) || 30,
    )
    setEnviando(false)
    if (resultado === 'ok') {
      setMensaje({ tipo: 'ok', texto: t('dispositivos.calibracionGuardada') })
      alGuardar(t('dispositivos.calibracionGuardada'))
    } else {
      setMensaje({ tipo: 'error', texto: t('comunes.error') })
    }
  }

  return (
    <form onSubmit={(e) => void enviar(e)} className="grid gap-3 animate-(--animate-pop-in) sm:grid-cols-2">
      <div>
        <Label htmlFor="c-fecha">{t('dispositivos.fechaCalibracion')}</Label>
        <SelectorFecha
          id="c-fecha"
          valor={form.fecha}
          invalido={fechaInvalida}
          onCambiar={(fecha) => {
            setForm((previo) => ({ ...previo, fecha }))
            if (fecha) setFechaInvalida(false)
          }}
        />
      </div>
      <div>
        <Label htmlFor="c-vencimiento">{t('dispositivos.fechaVencimiento')}</Label>
        <SelectorFecha id="c-vencimiento" valor={form.vencimiento} onCambiar={(vencimiento) => setForm((previo) => ({ ...previo, vencimiento }))} />
      </div>
      <div>
        <Label htmlFor="c-certificado">{t('dispositivos.numeroCertificado')}</Label>
        <Input id="c-certificado" className="codigo" value={form.certificado} onChange={(e) => setForm({ ...form, certificado: e.target.value })} required />
      </div>
      <div>
        <Label htmlFor="c-margen">{t('dispositivos.margenAviso')}</Label>
        <Input
          id="c-margen"
          type="number"
          min={1}
          max={365}
          value={form.margen}
          onChange={(e) => setForm({ ...form, margen: e.target.value })}
          aria-describedby="c-margen-ayuda"
          required
        />
        <p id="c-margen-ayuda" className="mt-1 text-meta text-muted">{t('dispositivos.margenAvisoAyuda')}</p>
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="c-observaciones">{t('dispositivos.observaciones')}</Label>
        <Textarea id="c-observaciones" value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
      </div>
      <MensajeFormulario mensaje={mensaje} className="sm:col-span-2" />
      <div className="sm:col-span-2">
        <PieFormulario>
          <Button variant="ghost" onClick={alCancelar} disabled={enviando}>{t('usuarios.cancelar')}</Button>
          <Button type="submit" disabled={enviando}>{enviando ? t('dispositivos.procesando') : t('comunes.guardar')}</Button>
        </PieFormulario>
      </div>
    </form>
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
        <span className="nums">{fechaCorta(inicio)}</span>
        <span className="nums">{t('dispositivos.calibracionTab.avisoDesde', { fecha: fechaCorta(fechaAviso) })}</span>
        <span className="nums">{fechaCorta(fin)}</span>
      </div>
    </div>
  )
}
