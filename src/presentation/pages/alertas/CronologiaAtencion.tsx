import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PencilLine } from 'lucide-react'

import type { ResultadoRectificacion } from '@/application/hooks/useAlertas'
import type { AccionCorrectiva, AlertaTermica } from '@/domain/entities/AlertaTermica'
import { fechaHora } from '@/lib/formato'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Esqueleto } from '../../components/ui/esqueleto'
import { Label, Textarea } from '../../components/ui/input'
import type { PuedeRectificar } from './tipos'

const MOTIVO_MIN = 10
const MOTIVO_MAX = 500

/** Color del marcador: solo indica el tipo de entrada (Refero Amie). */
const MARCADOR_NIVEL: Record<string, string> = {
  excursion_critica: 'bg-critical-solid',
  riesgo_preventivo: 'bg-warning-600',
  normal: 'bg-success-600',
}

function Entrada({
  marcador,
  ultima = false,
  resaltada = false,
  entradaRef,
  children,
}: {
  marcador: string
  ultima?: boolean
  resaltada?: boolean
  entradaRef?: React.Ref<HTMLLIElement>
  children: React.ReactNode
}) {
  return (
    <li
      ref={entradaRef}
      tabIndex={resaltada ? -1 : undefined}
      className={`flex gap-3 rounded-(--radius-small) focus-visible:outline-2 focus-visible:outline-ring ${resaltada ? 'resalte-entrada' : ''}`}
    >
      <div aria-hidden className="flex w-4 flex-col items-center">
        <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${marcador}`} />
        {!ultima && <span className="w-px flex-1 bg-border" />}
      </div>
      <div className="min-w-0 flex-1 pb-4">{children}</div>
    </li>
  )
}

/**
 * HU-23 criterio 4 y HU-28: cronología de atención (generada → revisada →
 * acciones, con sus rectificaciones). Solo lectura para el auditor; el autor
 * técnico, el farmacéutico y el administrador rectifican la versión vigente
 * en línea, sin borrar la original.
 */
export function CronologiaAtencion({
  alerta,
  obtenerCiclo,
  rectificarAccion,
  puedeRectificar,
  resaltarNueva = false,
}: {
  alerta: AlertaTermica
  obtenerCiclo: (alertaId: string) => Promise<AccionCorrectiva[]>
  rectificarAccion?: (accionId: string, descripcion: string, motivo: string) => Promise<ResultadoRectificacion>
  puedeRectificar: PuedeRectificar
  /** Tras registrar una acción: resalta y enfoca la entrada más reciente. */
  resaltarNueva?: boolean
}) {
  const { t } = useTranslation()
  const [ciclo, setCiclo] = useState<AccionCorrectiva[]>([])
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando')
  const [resaltada, setResaltada] = useState<string | null>(null)
  const [anuncio, setAnuncio] = useState('')
  const nuevaRef = useRef<HTMLLIElement>(null)
  const pedirResalte = useRef(resaltarNueva)

  // HU-28: rectificación en línea.
  const [aRectificar, setARectificar] = useState<AccionCorrectiva | null>(null)
  const [texto, setTexto] = useState('')
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errorRect, setErrorRect] = useState<'conflicto' | 'prohibido' | 'error' | null>(null)

  const cargar = useCallback(
    async (resaltar = false) => {
      setEstado((previo) => (previo === 'listo' ? 'listo' : 'cargando'))
      try {
        const datos = await obtenerCiclo(alerta.id)
        setCiclo(datos)
        setEstado('listo')
        if (resaltar && datos.length > 0) setResaltada(datos[datos.length - 1].id)
      } catch {
        setEstado('error')
      }
    },
    [alerta.id, obtenerCiclo],
  )

  useEffect(() => {
    void cargar(pedirResalte.current)
    pedirResalte.current = false
  }, [cargar])

  useEffect(() => {
    if (resaltada) nuevaRef.current?.focus()
  }, [resaltada])

  const abrirRectificacion = (accion: AccionCorrectiva) => {
    setARectificar(accion)
    setTexto(accion.descripcion)
    setMotivo('')
    setErrorRect(null)
    setAnuncio('')
  }

  const descripcionVacia = texto.trim().length === 0
  const motivoCorto = motivo.trim().length < MOTIVO_MIN
  const rectificacionBloqueada = guardando || descripcionVacia || motivoCorto

  const guardarRectificacion = async () => {
    if (!aRectificar || !rectificarAccion || rectificacionBloqueada) return
    setGuardando(true)
    setErrorRect(null)
    try {
      const resultado = await rectificarAccion(aRectificar.id, texto.trim(), motivo.trim())
      if (resultado === 'ok') {
        setARectificar(null)
        setAnuncio(t('alertas.panel.rectificacionGuardada'))
        await cargar(true)
      } else {
        setErrorRect(resultado)
        // Otro usuario la rectificó antes: la cronología cambió.
        if (resultado === 'conflicto') await cargar()
      }
    } finally {
      setGuardando(false)
    }
  }

  const fechaDeAccion = (id: string | null | undefined) => fechaHora(ciclo.find((a) => a.id === id)?.created_at ?? null)

  return (
    <div>
      <p role="status" className="sr-only">
        {estado === 'cargando' ? t('alertas.panel.cargandoCronologia') : anuncio}
      </p>
      <ol aria-label={t('alertas.cicloAtencion')} aria-busy={estado === 'cargando' || undefined}>
        {alerta.created_at && (
          <Entrada marcador={MARCADOR_NIVEL[alerta.nivel_riesgo] ?? 'bg-faint'}>
            <p className="text-body font-medium text-foreground">{t('alertas.eventoCreada')}</p>
            <p className="nums text-meta text-faint">
              <time dateTime={alerta.created_at}>{fechaHora(alerta.created_at)}</time>
            </p>
          </Entrada>
        )}
        {alerta.reconocida_en && (
          <Entrada marcador="bg-faint">
            <p className="text-body font-medium text-foreground">{t('alertas.eventoReconocida')}</p>
            <p className="nums text-meta text-faint">
              <time dateTime={alerta.reconocida_en}>{fechaHora(alerta.reconocida_en)}</time>
            </p>
            {alerta.revisada_por && (
              <p className="text-meta text-muted">
                {t('alertas.responsable')}: {alerta.revisada_por_nombre ?? alerta.revisada_por}
              </p>
            )}
          </Entrada>
        )}
        {estado === 'cargando' &&
          [0, 1].map((i) => (
            <li key={`esq-${i}`} aria-hidden className="flex gap-3 pb-4">
              <Esqueleto className="mt-1.5 size-2.5 rounded-full" />
              <div className="flex-1 space-y-2">
                <Esqueleto className="h-4 w-1/2" />
                <Esqueleto className="h-3 w-1/3" />
              </div>
            </li>
          ))}
        {estado === 'error' && (
          <li role="alert" className="flex flex-wrap items-center gap-3 rounded-(--radius-field) bg-critical-tint px-3 py-2 text-body text-critical">
            <span className="min-w-0 flex-1">{t('comunes.error')}</span>
            <Button size="sm" variant="secondary" onClick={() => void cargar()}>
              {t('comunes.reintentar')}
            </Button>
          </li>
        )}
        {estado === 'listo' &&
          ciclo.map((accion, indice) => {
            const vigente = accion.vigente !== false
            const esRectificacion = Boolean(accion.corrige_accion_id)
            return (
              <Entrada
                key={accion.id}
                marcador={esRectificacion ? 'bg-subtle' : 'bg-success-600'}
                ultima={indice === ciclo.length - 1}
                resaltada={resaltada === accion.id}
                entradaRef={resaltada === accion.id ? nuevaRef : undefined}
              >
                <p className="flex flex-wrap items-center gap-2 text-body font-medium text-foreground">
                  {esRectificacion ? t('alertas.eventoRectificada') : t('alertas.eventoAtendida')}
                  {!vigente && <Badge variant="outline">{t('alertas.rectificada')}</Badge>}
                </p>
                <p className="nums text-meta text-faint">
                  <time dateTime={accion.created_at ?? undefined}>{fechaHora(accion.created_at)}</time>
                </p>
                <p className="text-meta text-muted">
                  {t('alertas.responsable')}: {accion.usuario_nombre ?? accion.usuario_id}
                </p>
                {accion.corrige_accion_id && (
                  <p className="text-meta text-muted">{t('alertas.rectificaA', { fecha: fechaDeAccion(accion.corrige_accion_id) })}</p>
                )}
                <p className={vigente ? 'mt-1 text-body text-foreground' : 'mt-1 text-body text-muted'}>{accion.descripcion}</p>
                {accion.decision && (
                  <p className="mt-1 text-meta text-muted">
                    {t('alertas.etiquetaDecision')}: {accion.decision}
                  </p>
                )}
                {accion.justificacion && (
                  <p className="mt-1 text-meta text-muted">
                    {t('alertas.etiquetaJustificacion')}: {accion.justificacion}
                  </p>
                )}
                {accion.motivo_rectificacion && (
                  <p className="mt-1 text-meta text-muted">
                    {t('alertas.motivo')}: {accion.motivo_rectificacion}
                  </p>
                )}
                {puedeRectificar(accion) && aRectificar?.id !== accion.id && (
                  <Button size="sm" variant="ghost" className="mt-1 -ml-2" onClick={() => abrirRectificacion(accion)}>
                    <PencilLine aria-hidden />
                    {t('alertas.rectificar')}
                  </Button>
                )}
                {aRectificar?.id === accion.id && (
                  <div className="mt-3 animate-(--animate-rise) space-y-3 rounded-(--radius-field) border border-border p-3">
                    <p className="text-meta text-muted">{t('alertas.rectificarAyuda')}</p>
                    <div>
                      <Label htmlFor="rectificacion-texto">{t('alertas.nuevaDescripcion')}</Label>
                      <Textarea
                        id="rectificacion-texto"
                        value={texto}
                        onChange={(e) => setTexto(e.target.value)}
                        maxLength={2000}
                        aria-required="true"
                      />
                    </div>
                    <div>
                      <Label htmlFor="rectificacion-motivo">{t('alertas.motivoRectificacion')}</Label>
                      <Textarea
                        id="rectificacion-motivo"
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        maxLength={MOTIVO_MAX}
                        rows={2}
                        aria-required="true"
                        aria-describedby="rectificacion-motivo-ayuda rectificacion-motivo-contador"
                      />
                      <div className="mt-1 flex items-start justify-between gap-3 text-meta text-faint">
                        <p id="rectificacion-motivo-ayuda">{t('alertas.motivoRectificacionAyuda')}</p>
                        <p
                          id="rectificacion-motivo-contador"
                          aria-live={motivo.length >= 490 ? 'polite' : 'off'}
                          className="nums shrink-0"
                        >
                          {t('alertas.panel.contador', { actual: motivo.length, max: MOTIVO_MAX })}
                        </p>
                      </div>
                    </div>
                    {errorRect && (
                      <p role="alert" className="text-meta text-critical">
                        {t(`alertas.errorRectificacion.${errorRect}`)}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {rectificacionBloqueada && !guardando && (
                        <p id="rectificacion-falta" className="mr-auto text-meta text-faint">
                          {descripcionVacia ? t('alertas.panel.descripcionVacia') : t('alertas.panel.motivoCorto')}
                        </p>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setARectificar(null)} disabled={guardando}>
                        {t('comunes.cancelar')}
                      </Button>
                      <Button
                        size="sm"
                        className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                        aria-disabled={rectificacionBloqueada || undefined}
                        aria-describedby={rectificacionBloqueada && !guardando ? 'rectificacion-falta' : undefined}
                        onClick={() => void guardarRectificacion()}
                      >
                        {guardando ? t('alertas.guardando') : t('alertas.guardarRectificacion')}
                      </Button>
                    </div>
                  </div>
                )}
              </Entrada>
            )
          })}
        {estado === 'listo' && ciclo.length === 0 && <li className="pl-7 text-body text-muted">{t('alertas.sinAcciones')}</li>}
      </ol>
    </div>
  )
}
