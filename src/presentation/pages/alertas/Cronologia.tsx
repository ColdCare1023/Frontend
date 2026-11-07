import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PencilLine } from 'lucide-react'

import type { ResultadoRectificacion } from '@/application/hooks/useAlertas'
import type { AccionCorrectiva, AlertaTermica } from '@/domain/entities/AlertaTermica'
import { fechaHora } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Label, Textarea } from '../../components/ui/input'

/**
 * HU-23 criterio 4 y HU-28: los hechos de la atención en orden, con la rectificación en línea. La
 * acción original nunca se toca: rectificar agrega una versión con su motivo.
 */
export function Cronologia({
  alerta,
  obtenerCicloAtencion,
  rectificarAccion,
  puedeRectificar,
}: {
  alerta: AlertaTermica
  obtenerCicloAtencion: (alertaId: string) => Promise<AccionCorrectiva[]>
  rectificarAccion: (accionId: string, descripcion: string, motivo: string) => Promise<ResultadoRectificacion>
  puedeRectificar: (accion: AccionCorrectiva) => boolean
}) {
  const { t } = useTranslation()
  const [ciclo, setCiclo] = useState<AccionCorrectiva[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(false)

  const [enCurso, setEnCurso] = useState<AccionCorrectiva | null>(null)
  const [texto, setTexto] = useState('')
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errorRectificacion, setErrorRectificacion] = useState<ResultadoRectificacion | null>(null)

  // Una respuesta que llega tarde (se eligió otro aviso, se desmontó) no pisa lo que se ve.
  const turno = useRef(0)
  const cargar = useCallback(async () => {
    const propio = ++turno.current
    setErrorCarga(false)
    setCargando(true)
    try {
      const acciones = await obtenerCicloAtencion(alerta.id)
      if (propio === turno.current) setCiclo(acciones)
    } catch {
      if (propio === turno.current) {
        setCiclo([])
        setErrorCarga(true)
      }
    } finally {
      if (propio === turno.current) setCargando(false)
    }
  }, [alerta.id, obtenerCicloAtencion])

  useEffect(() => {
    void cargar()
    return () => {
      turno.current += 1
    }
  }, [cargar])

  const abrir = (accion: AccionCorrectiva) => {
    setEnCurso(accion)
    setTexto(accion.descripcion)
    setMotivo('')
    setErrorRectificacion(null)
  }

  const guardar = async () => {
    if (!enCurso) return
    setGuardando(true)
    setErrorRectificacion(null)
    try {
      const resultado = await rectificarAccion(enCurso.id, texto.trim(), motivo.trim())
      if (resultado === 'ok') {
        setEnCurso(null)
        await cargar()
      } else {
        setErrorRectificacion(resultado)
        // Otro usuario la rectificó antes: la cronología cambió.
        if (resultado === 'conflicto') await cargar()
      }
    } finally {
      setGuardando(false)
    }
  }

  const fechaDeAccion = (id: string | null | undefined) => fechaHora(ciclo.find((a) => a.id === id)?.created_at ?? null)

  return (
    <section aria-labelledby={`cronologia-${alerta.id}`}>
      <h3 id={`cronologia-${alerta.id}`} className="mb-3 text-[15px] leading-6 font-semibold text-foreground">
        {t('alertas.cicloAtencion')}
      </h3>
      <ol className="cronologia-aviso">
        {alerta.created_at && (
          <li>
            <p className="text-[13.5px] leading-5 font-medium text-foreground">{t('alertas.eventoCreada')}</p>
            <p className="nums text-xs leading-5 text-muted">{fechaHora(alerta.created_at)}</p>
          </li>
        )}
        {alerta.reconocida_en && (
          <li>
            <p className="text-[13.5px] leading-5 font-medium text-foreground">{t('alertas.eventoReconocida')}</p>
            <p className="nums text-xs leading-5 text-muted">{fechaHora(alerta.reconocida_en)}</p>
            {alerta.revisada_por && (
              <p className="nums text-xs leading-5 text-muted">
                {t('alertas.responsable')}: {alerta.revisada_por_nombre ?? alerta.revisada_por}
              </p>
            )}
          </li>
        )}
        {cargando ? (
          <li className="text-[13.5px] leading-5 text-muted">{t('app.cargando')}</li>
        ) : errorCarga ? (
          <li role="alert" className="text-[13.5px] leading-5 text-critical">{t('comunes.error')}</li>
        ) : ciclo.length === 0 ? (
          <li className="text-[13.5px] leading-5 text-muted">{t('alertas.sinAcciones')}</li>
        ) : (
          ciclo.map((accion) => (
            <li key={accion.id}>
              <p className="flex flex-wrap items-center gap-2 text-[13.5px] leading-5 font-medium text-foreground">
                {accion.corrige_accion_id ? t('alertas.eventoRectificada') : t('alertas.eventoAtendida')}
                {accion.vigente === false && <Badge variant="outline">{t('alertas.rectificada')}</Badge>}
              </p>
              <p className="nums text-xs leading-5 text-muted">{fechaHora(accion.created_at)}</p>
              <p className="nums text-xs leading-5 text-muted">
                {t('alertas.responsable')}: {accion.usuario_nombre ?? accion.usuario_id}
              </p>
              {accion.corrige_accion_id && (
                <p className="text-xs leading-5 text-muted">{t('alertas.rectificaA', { fecha: fechaDeAccion(accion.corrige_accion_id) })}</p>
              )}
              <p className={cn('mt-1 text-[13.5px] leading-5', accion.vigente === false ? 'text-muted' : 'text-foreground')}>{accion.descripcion}</p>
              {accion.motivo_rectificacion && (
                <p className="mt-1 text-xs leading-5 text-muted">
                  {t('alertas.motivo')}: {accion.motivo_rectificacion}
                </p>
              )}
              {puedeRectificar(accion) && enCurso?.id !== accion.id && (
                <Button size="sm" variant="ghost" className="mt-1 -ml-3" onClick={() => abrir(accion)}>
                  <PencilLine />
                  {t('alertas.rectificar')}
                </Button>
              )}
              {enCurso?.id === accion.id && (
                <div className="mt-2 space-y-3 rounded-(--radius-field) border border-border p-3">
                  <p className="text-xs leading-5 text-muted">{t('alertas.rectificarAyuda')}</p>
                  <div>
                    <Label htmlFor="rectificacion-texto">{t('alertas.nuevaDescripcion')}</Label>
                    <Textarea id="rectificacion-texto" value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={2000} />
                  </div>
                  <div>
                    <Label htmlFor="rectificacion-motivo">{t('alertas.motivoRectificacion')}</Label>
                    <Textarea
                      id="rectificacion-motivo"
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      maxLength={500}
                      aria-describedby="rectificacion-motivo-ayuda"
                    />
                    <p id="rectificacion-motivo-ayuda" className="mt-1 text-xs text-muted">{t('alertas.motivoRectificacionAyuda')}</p>
                  </div>
                  {errorRectificacion && (
                    <p role="alert" className="text-xs leading-5 text-critical">{t(`alertas.errorRectificacion.${errorRectificacion}`)}</p>
                  )}
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setEnCurso(null)} disabled={guardando}>
                      {t('comunes.cancelar')}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => void guardar()}
                      disabled={guardando || texto.trim().length === 0 || motivo.trim().length < 10}
                    >
                      {guardando ? t('alertas.guardando') : t('alertas.guardarRectificacion')}
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))
        )}
      </ol>
    </section>
  )
}
