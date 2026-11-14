import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { DatosCalibracion, ResultadoCalibracion } from '@/application/hooks/useCalibracion'
import type { Dispositivo } from '@/domain/entities/Dispositivo'
import { Button } from '../../components/ui/button'
import { Input, Label, Textarea } from '../../components/ui/input'
import { SelectorFecha } from '../../components/ui/selector-fecha'
import { MensajeFormulario, PieFormulario, type Mensaje } from '../dispositivos/compartido'

/**
 * HU-30: registro del certificado de calibración y de su margen de aviso. Lo
 * usan la pestaña Calibración del administrador y la ficha del equipo del
 * Químico Farmacéutico en Monitoreo; cada uno decide cómo se envía.
 * Misma validación y mismo cuerpo que CalibracionRequest (B-12).
 */
export function FormCalibracion({
  dispositivo,
  registrar,
  alCancelar,
  alGuardar,
}: {
  dispositivo: Pick<Dispositivo, 'numero_certificado_calibracion' | 'margen_aviso_calibracion_dias' | 'observaciones_calibracion'>
  registrar: (datos: DatosCalibracion) => Promise<ResultadoCalibracion>
  alCancelar: () => void
  alGuardar: (texto: string) => void
}) {
  const { t } = useTranslation()
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
    const resultado = await registrar({
      fecha: form.fecha,
      certificado: form.certificado,
      observaciones: form.observaciones,
      vencimiento: form.vencimiento,
      margen: Number(form.margen) || 30,
    })
    setEnviando(false)
    if (resultado === 'ok') {
      setMensaje({ tipo: 'ok', texto: t('dispositivos.calibracionGuardada') })
      alGuardar(t('dispositivos.calibracionGuardada'))
    } else if (resultado === 'sin_permiso') {
      setMensaje({ tipo: 'error', texto: t('dispositivos.calibracionSinPermiso') })
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
