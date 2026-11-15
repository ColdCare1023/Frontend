import { useRef, useState } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { GitBranch, Lock, Plus, TriangleAlert } from 'lucide-react'

import {
  useVersionesModelo,
  type NuevaVersionModelo,
  type ResultadoVersion,
  type VersionModeloIA,
} from '@/application/hooks/useVersionesModelo'
import { fechaHora } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { EstadoError } from '../../components/EstadoPagina'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/dialog'
import { Esqueleto } from '../../components/ui/esqueleto'
import { Input, Label, Textarea } from '../../components/ui/input'
import { SelectorFecha } from '../../components/ui/selector-fecha'
import {
  SidePanel,
  SidePanelBody,
  SidePanelContent,
  SidePanelDescription,
  SidePanelFooter,
  SidePanelHeader,
  SidePanelTitle,
} from '../../components/ui/side-panel'
import { clasificarRechazo, textoMotivo, type GrupoMotivo, type ModeloArtefacto, type RechazoActivacion } from './motivosActivacion'
import { FORM_VERSION_VACIO, validarNuevaVersion, type FormularioVersion } from './validarVersion'

type Aviso = { tipo: 'ok' | 'error'; texto: string; detalle?: string | null; rechazo?: RechazoActivacion } | null

/** HU-46: artefacto que el backend comprueba al activar (GET /api/ia/preventivo). */
export interface ArtefactoGobernado {
  modelo: ModeloArtefacto
  /** IA_PREVENTIVO_VERSION desplegada (solo el preventivo la informa). */
  version: string | null
}

const GRUPOS: GrupoMotivo[] = ['criterios', 'artefacto', 'otros']

function MotivosRechazo({ rechazo }: { rechazo: RechazoActivacion }) {
  const { t } = useTranslation()
  return (
    <div className="mt-1 space-y-1" data-testid="motivos-rechazo">
      {GRUPOS.map((grupo) => {
        const motivos = rechazo.motivos.filter((m) => m.grupo === grupo)
        if (motivos.length === 0) return null
        const titulo =
          grupo === 'artefacto'
            ? t(`metricasIA.versiones.grupos.artefacto_${rechazo.artefacto ?? 'desconocido'}`)
            : t(`metricasIA.versiones.grupos.${grupo}`)
        return (
          <div key={grupo} data-grupo={grupo}>
            <p>{titulo}</p>
            <ul className="list-disc space-y-0.5 pl-4">
              {motivos.map((m) => <li key={m.texto}>{m.texto}</li>)}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

function AvisoResultado({ aviso, className }: { aviso: Aviso; className?: string }) {
  const { t } = useTranslation()
  if (!aviso) return null
  const conMotivos = (aviso.rechazo?.motivos.length ?? 0) > 0
  return (
    <div
      role={aviso.tipo === 'error' ? 'alert' : 'status'}
      className={cn(
        'rounded-(--radius-field) px-3 py-2 text-meta',
        aviso.tipo === 'ok' ? 'bg-success-100 text-success-700' : 'bg-critical-tint text-critical',
        className,
      )}
    >
      <p className="font-medium">{aviso.texto}</p>
      {conMotivos && aviso.rechazo ? (
        <MotivosRechazo rechazo={aviso.rechazo} />
      ) : (
        aviso.detalle && <p className="mt-0.5">{t('metricasIA.versiones.motivoServidor', { detalle: aviso.detalle })}</p>
      )}
    </div>
  )
}

function textoArtefacto(artefacto: ArtefactoGobernado, t: TFunction): string {
  return artefacto.modelo === 'preventivo'
    ? artefacto.version
      ? t('metricasIA.versiones.artefactoPreventivoVersion', { version: artefacto.version })
      : t('metricasIA.versiones.artefactoPreventivo')
    : t('metricasIA.versiones.artefactoLegado')
}

/**
 * HU-46: versionado operativo del modelo en la página del Clasificador. El
 * administrador lista, registra y activa; el auditor solo consulta. Los
 * rechazos del backend (409 por criterios o porque el artefacto desplegado
 * —preventivo o legado— no es el de la versión, 404 por versión no
 * registrada, 422 por solicitud no válida) se muestran con sus motivos: la
 * versión activa vigente no cambia y el intento queda en la bitácora.
 */
export function VersionesModelo({
  puedeGestionar,
  artefacto = null,
  onCambio,
  className,
}: {
  puedeGestionar: boolean
  /** Qué artefacto comprueba el backend al activar; null si no se sabe. */
  artefacto?: ArtefactoGobernado | null
  /** Tras activar (o intentarlo): el estado de la clasificación preventiva puede cambiar. */
  onCambio?: () => void
  className?: string
}) {
  const { t } = useTranslation()
  const { versiones, cargando, error, consultar, registrar, activar } = useVersionesModelo(true)
  const [aviso, setAviso] = useState<Aviso>(null)
  const [registroAbierto, setRegistroAbierto] = useState(false)
  const [porActivar, setPorActivar] = useState<VersionModeloIA | null>(null)
  const [activando, setActivando] = useState(false)
  const botonRegistrar = useRef<HTMLButtonElement>(null)
  const activa = versiones.find((v) => v.activa) ?? null

  const confirmarActivacion = async () => {
    if (!porActivar) return
    const version = porActivar.version
    setActivando(true)
    const resultado = await activar(version)
    setActivando(false)
    setPorActivar(null)
    setAviso(avisoDeActivacion(resultado, version, artefacto?.modelo ?? null, t))
    onCambio?.()
  }

  return (
    <section aria-labelledby="versiones-modelo-titulo" className={cn('superficie p-4 xl:p-5', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-72">
          <h2 id="versiones-modelo-titulo" className="flex items-center gap-2 text-title text-foreground">
            <GitBranch aria-hidden className="size-4 text-muted" />
            {t('metricasIA.versiones.titulo')}
          </h2>
          <p className="text-meta text-muted">{t('metricasIA.versiones.descripcion')}</p>
          {artefacto && (
            <p data-testid="artefacto-gobernado" data-modelo={artefacto.modelo} className="mt-1 text-meta text-muted">
              {textoArtefacto(artefacto, t)}
            </p>
          )}
        </div>
        {puedeGestionar ? (
          <Button
            ref={botonRegistrar}
            size="sm"
            variant="secondary"
            onClick={() => {
              setAviso(null)
              setRegistroAbierto(true)
            }}
          >
            <Plus aria-hidden />
            {t('metricasIA.versiones.registrar')}
          </Button>
        ) : (
          <p className="flex items-center gap-1.5 text-meta text-muted">
            <Lock aria-hidden className="size-3.5 shrink-0" />
            {t('metricasIA.versiones.soloLectura')}
          </p>
        )}
      </div>

      <AvisoResultado aviso={aviso} className="mt-3" />

      <div className="mt-3">
        {cargando && versiones.length === 0 ? (
          <div role="status" className="space-y-2">
            <span className="sr-only">{t('app.cargando')}</span>
            <Esqueleto aria-hidden className="h-20 w-full" />
            <Esqueleto aria-hidden className="h-20 w-full" />
          </div>
        ) : error ? (
          <EstadoError mensaje={t('metricasIA.versiones.errorCarga')}>
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => void consultar()}>
              {t('metricasIA.reintentar')}
            </Button>
          </EstadoError>
        ) : versiones.length === 0 ? (
          <p role="status" className="rounded-(--radius-field) border border-dashed border-border px-3 py-4 text-body text-muted">
            {t('metricasIA.versiones.vacio')}
          </p>
        ) : (
          <ul aria-label={t('metricasIA.versiones.lista')} className="divide-y divide-border">
            {versiones.map((version) => (
              <FilaVersion
                key={version.version}
                version={version}
                puedeGestionar={puedeGestionar}
                onActivar={() => {
                  setAviso(null)
                  setPorActivar(version)
                }}
              />
            ))}
          </ul>
        )}
      </div>

      {puedeGestionar && (
        <>
          <Dialog open={porActivar !== null} onOpenChange={(abierto) => !abierto && !activando && setPorActivar(null)}>
            {porActivar && (
              <DialogContent destructivo>
                <DialogTitle>{t('metricasIA.versiones.confirmarTitulo', { version: porActivar.version })}</DialogTitle>
                <DialogDescription>
                  {activa
                    ? t('metricasIA.versiones.confirmarReemplaza', { actual: activa.version })
                    : t('metricasIA.versiones.confirmarSinActiva')}{' '}
                  {t('metricasIA.versiones.confirmarTraza')}
                </DialogDescription>
                {artefacto && <p className="mt-2 text-meta text-muted">{textoArtefacto(artefacto, t)}</p>}
                {(porActivar.motivos_bloqueo?.length ?? 0) > 0 && (
                  <div className="mt-3 rounded-(--radius-field) bg-warning-100 px-3 py-2 text-meta text-warning-700">
                    <p className="font-medium">{t('metricasIA.versiones.confirmarBloqueo')}</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4">
                      {porActivar.motivos_bloqueo?.map((motivo) => <li key={motivo}>{textoMotivo(motivo, t)}</li>)}
                    </ul>
                  </div>
                )}
                <div className="mt-5 flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setPorActivar(null)} disabled={activando}>
                    {t('comunes.cancelar')}
                  </Button>
                  <Button onClick={() => void confirmarActivacion()} disabled={activando}>
                    {activando ? t('metricasIA.versiones.activando') : t('metricasIA.versiones.confirmar')}
                  </Button>
                </div>
              </DialogContent>
            )}
          </Dialog>
          <PanelRegistrarVersion
            abierto={registroAbierto}
            onAbiertoChange={setRegistroAbierto}
            registrar={registrar}
            onRegistrada={(version, activa) => {
              setRegistroAbierto(false)
              setAviso({
                tipo: 'ok',
                texto: t(activa ? 'metricasIA.versiones.registradaYActivada' : 'metricasIA.versiones.registrada', { version }),
              })
              if (activa) onCambio?.()
            }}
            onCloseAutoFocus={(evento) => {
              evento.preventDefault()
              botonRegistrar.current?.focus()
            }}
          />
        </>
      )}
    </section>
  )
}

function avisoDeActivacion(resultado: ResultadoVersion, version: string, gobernado: ModeloArtefacto | null, t: TFunction): Aviso {
  if (resultado.resultado === 'ok') return { tipo: 'ok', texto: t('metricasIA.versiones.activada', { version }) }
  if (resultado.resultado === 'conflicto') {
    // 409: criterios de la versión y/o el artefacto que se cargará (HU-16 esc. 4).
    const rechazo = clasificarRechazo(resultado.detalle, gobernado, t)
    const texto = rechazo.soloArtefacto
      ? t(`metricasIA.versiones.rechazadaArtefacto_${rechazo.artefacto ?? 'desconocido'}`, { version })
      : t('metricasIA.versiones.rechazadaCriterios', { version })
    return { tipo: 'error', texto, detalle: resultado.detalle, rechazo }
  }
  if (resultado.resultado === 'no_encontrada') return { tipo: 'error', texto: t('metricasIA.versiones.rechazadaNoRegistrada', { version }), detalle: resultado.detalle }
  if (resultado.resultado === 'invalida') return { tipo: 'error', texto: t('metricasIA.versiones.rechazadaInvalida', { version }), detalle: resultado.detalle }
  if (resultado.resultado === 'sin_permiso') return { tipo: 'error', texto: t('metricasIA.versiones.sinPermiso') }
  return { tipo: 'error', texto: t('metricasIA.versiones.errorActivar'), detalle: resultado.detalle }
}

function FilaVersion({ version, puedeGestionar, onActivar }: { version: VersionModeloIA; puedeGestionar: boolean; onActivar: () => void }) {
  const { t } = useTranslation()
  const motivos = version.motivos_bloqueo ?? []
  const criterio = version.criterio_principal
  return (
    <li className="py-3 first:pt-0 last:pb-0" data-testid={`version-modelo-${version.version}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="codigo text-body font-semibold text-foreground">{version.version}</span>
        {version.activa ? (
          <Badge variant="ok" dot>{t('metricasIA.versiones.activa')}</Badge>
        ) : version.activable === false || motivos.length > 0 ? (
          <Badge variant="warn">{t('metricasIA.versiones.bloqueada')}</Badge>
        ) : (
          <Badge variant="outline">{t('metricasIA.versiones.activable')}</Badge>
        )}
        {puedeGestionar && !version.activa && (
          <Button
            size="sm"
            variant="secondary"
            className="ml-auto"
            aria-label={t('metricasIA.versiones.activarEtiqueta', { version: version.version })}
            onClick={onActivar}
          >
            {t('metricasIA.versiones.activar')}
          </Button>
        )}
      </div>
      <p className="nums mt-1 text-meta text-muted">
        {[
          t('metricasIA.versiones.entrenada', { fecha: fechaHora(version.trained_at) }),
          version.aprobado_en ? t('metricasIA.versiones.aprobada', { fecha: fechaHora(version.aprobado_en) }) : null,
          version.activada_en ? t('metricasIA.versiones.activadaEl', { fecha: fechaHora(version.activada_en) }) : null,
          version.desactivada_en ? t('metricasIA.versiones.desactivadaEl', { fecha: fechaHora(version.desactivada_en) }) : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-meta sm:grid-cols-3 xl:grid-cols-6">
        {(
          [
            [t('metricasIA.versiones.esquema'), version.feature_schema_version],
            [t('metricasIA.versiones.dataset'), version.dataset_version],
            ['scikit-learn', version.scikit_learn_version],
            ['Python', version.python_version],
            [t('metricasIA.versiones.horizonte'), version.horizonte_min != null ? t('metricasIA.versiones.horizonteValor', { min: version.horizonte_min }) : '—'],
            [t('metricasIA.versiones.criterio'), criterio ? t(`metricasIA.versiones.criterios.${criterio}`, { defaultValue: criterio }) : '—'],
          ] as const
        ).map(([etiqueta, valor]) => (
          <div key={etiqueta} className="min-w-0">
            <dt className="text-muted">{etiqueta}</dt>
            <dd className="nums truncate font-medium text-foreground" title={String(valor)}>{valor}</dd>
          </div>
        ))}
        <div className="col-span-2 min-w-0 sm:col-span-3 xl:col-span-6">
          <dt className="text-muted">{t('metricasIA.versiones.huella')}</dt>
          <dd className="codigo break-all text-foreground">{version.model_hash}</dd>
        </div>
      </dl>
      {!version.activa && motivos.length > 0 && (
        <div className="mt-2 flex items-start gap-2 text-meta text-warning-700">
          <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          <div className="min-w-0">
            <p className="font-medium">{t('metricasIA.versiones.motivosTitulo')}</p>
            <ul className="list-disc space-y-0.5 pl-4">
              {motivos.map((motivo) => <li key={motivo}>{textoMotivo(motivo, t)}</li>)}
            </ul>
          </div>
        </div>
      )}
    </li>
  )
}

function PanelRegistrarVersion({
  abierto,
  onAbiertoChange,
  registrar,
  onRegistrada,
  onCloseAutoFocus,
}: {
  abierto: boolean
  onAbiertoChange: (abierto: boolean) => void
  registrar: (nueva: NuevaVersionModelo) => Promise<ResultadoVersion>
  onRegistrada: (version: string, activa: boolean) => void
  onCloseAutoFocus: (evento: Event) => void
}) {
  const { t } = useTranslation()
  const [form, setForm] = useState<FormularioVersion>(FORM_VERSION_VACIO)
  // HU-46 esc. 1: registrar y marcar como activa en un solo paso (opcional).
  const [activarAlRegistrar, setActivarAlRegistrar] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState<Aviso>(null)

  const cambiarAbierto = (valor: boolean) => {
    if (enviando) return
    if (!valor) {
      setForm(FORM_VERSION_VACIO)
      setActivarAlRegistrar(false)
      setAviso(null)
    }
    onAbiertoChange(valor)
  }

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault()
    const validado = validarNuevaVersion(form, t)
    if ('error' in validado) {
      setAviso({ tipo: 'error', texto: validado.error })
      return
    }
    setEnviando(true)
    setAviso(null)
    const resultado = await registrar({ ...validado.nueva, activar: activarAlRegistrar })
    setEnviando(false)
    if (resultado.resultado === 'ok') {
      setForm(FORM_VERSION_VACIO)
      setActivarAlRegistrar(false)
      onRegistrada(resultado.version.version, resultado.version.activa === true)
      return
    }
    setAviso({
      tipo: 'error',
      texto:
        resultado.resultado === 'conflicto'
          ? t(activarAlRegistrar ? 'metricasIA.versiones.form.rechazadaAlActivar' : 'metricasIA.versiones.form.duplicada')
          : resultado.resultado === 'invalida'
            ? t('metricasIA.versiones.form.invalida')
            : resultado.resultado === 'sin_permiso'
              ? t('metricasIA.versiones.sinPermiso')
              : t('metricasIA.versiones.form.error'),
      detalle: resultado.detalle,
    })
  }

  const campo = (nombre: keyof FormularioVersion, etiqueta: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <Label htmlFor={`v-${nombre}`}>{etiqueta}</Label>
      <Input id={`v-${nombre}`} value={form[nombre]} onChange={(e) => setForm({ ...form, [nombre]: e.target.value })} {...extra} />
    </div>
  )

  return (
    <SidePanel open={abierto} onOpenChange={cambiarAbierto}>
      <SidePanelContent className="sm:max-w-[520px]" onCloseAutoFocus={onCloseAutoFocus}>
        <SidePanelHeader>
          <SidePanelTitle>{t('metricasIA.versiones.form.titulo')}</SidePanelTitle>
          <SidePanelDescription>{t('metricasIA.versiones.form.descripcion')}</SidePanelDescription>
        </SidePanelHeader>
        <SidePanelBody>
          <form id="form-version-modelo" onSubmit={(e) => void enviar(e)} className="grid gap-3 sm:grid-cols-2">
            {campo('version', t('metricasIA.versiones.form.version'), { required: true, maxLength: 50, className: 'codigo' })}
            <div>
              <Label htmlFor="v-trained_at">{t('metricasIA.versiones.form.entrenadoEl')}</Label>
              <SelectorFecha id="v-trained_at" conHora valor={form.trained_at} onCambiar={(valor) => setForm((previo) => ({ ...previo, trained_at: valor }))} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="v-model_hash">{t('metricasIA.versiones.form.huella')}</Label>
              <Input
                id="v-model_hash"
                className="codigo"
                value={form.model_hash}
                onChange={(e) => setForm({ ...form, model_hash: e.target.value })}
                required
                minLength={64}
                maxLength={64}
                spellCheck={false}
                autoComplete="off"
                aria-describedby="v-model_hash-ayuda"
              />
              <p id="v-model_hash-ayuda" className="mt-1 text-meta text-muted">{t('metricasIA.versiones.form.huellaAyuda')}</p>
            </div>
            {campo('feature_schema_version', t('metricasIA.versiones.esquema'), { required: true, maxLength: 20 })}
            {campo('dataset_version', t('metricasIA.versiones.dataset'), { required: true, maxLength: 50 })}
            {campo('scikit_learn_version', 'scikit-learn', { required: true, maxLength: 20, placeholder: '1.9.0' })}
            {campo('python_version', 'Python', { required: true, maxLength: 20, placeholder: '3.12' })}
            <div className="sm:col-span-2">
              <Label htmlFor="v-horizonte_min">{t('metricasIA.versiones.form.horizonte')}</Label>
              <Input
                id="v-horizonte_min"
                type="number"
                min={1}
                max={1440}
                value={form.horizonte_min}
                onChange={(e) => setForm({ ...form, horizonte_min: e.target.value })}
                aria-describedby="v-horizonte_min-ayuda"
              />
              <p id="v-horizonte_min-ayuda" className="mt-1 text-meta text-muted">{t('metricasIA.versiones.form.horizonteAyuda')}</p>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="v-metricas">{t('metricasIA.versiones.form.metricas')}</Label>
              <Textarea
                id="v-metricas"
                className="codigo"
                spellCheck={false}
                value={form.metricas}
                onChange={(e) => setForm({ ...form, metricas: e.target.value })}
                placeholder='{"sensibilidad_incidente": 0.86, "f1_macro": 0.88}'
                aria-describedby="v-metricas-ayuda"
              />
              <p id="v-metricas-ayuda" className="mt-1 text-meta text-muted">{t('metricasIA.versiones.form.metricasAyuda')}</p>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="v-particiones">{t('metricasIA.versiones.form.particiones')}</Label>
              <Textarea
                id="v-particiones"
                className="codigo"
                spellCheck={false}
                value={form.particiones}
                onChange={(e) => setForm({ ...form, particiones: e.target.value })}
                placeholder='{"entrenamiento": ["corrida-01"], "prueba": ["corrida-05"], "separacion_min": 60}'
                aria-describedby="v-particiones-ayuda"
              />
              <p id="v-particiones-ayuda" className="mt-1 text-meta text-muted">{t('metricasIA.versiones.form.particionesAyuda')}</p>
            </div>
            <label className="flex min-h-11 items-start gap-2 text-body sm:col-span-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={activarAlRegistrar}
                onChange={(e) => setActivarAlRegistrar(e.target.checked)}
                aria-describedby="v-activar-ayuda"
              />
              <span>{t('metricasIA.versiones.form.activarAlRegistrar')}</span>
            </label>
            <p id="v-activar-ayuda" className="text-meta text-muted sm:col-span-2">
              {t(activarAlRegistrar ? 'metricasIA.versiones.form.activarAlRegistrarAyuda' : 'metricasIA.versiones.form.noActiva')}
            </p>
            <AvisoResultado aviso={aviso} className="sm:col-span-2" />
          </form>
        </SidePanelBody>
        <SidePanelFooter>
          <Button variant="ghost" onClick={() => cambiarAbierto(false)} disabled={enviando}>
            {t('comunes.cancelar')}
          </Button>
          <Button type="submit" form="form-version-modelo" disabled={enviando}>
            {enviando ? t('metricasIA.versiones.form.enviando') : t('metricasIA.versiones.form.guardar')}
          </Button>
        </SidePanelFooter>
      </SidePanelContent>
    </SidePanel>
  )
}
