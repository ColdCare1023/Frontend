import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { BellOff, Check } from 'lucide-react'

import { useAlertas, type FiltroEstado } from '@/application/hooks/useAlertas'
import { useEstadoOperativo } from '@/application/hooks/useEstadoOperativo'
import { useAuthStore } from '@/application/stores/authStore'
import type { AccionCorrectiva, AlertaTermica } from '@/domain/entities/AlertaTermica'
import { tienePermiso } from '@/domain/value-objects/Rol'
import { rangoPagina } from '@/lib/paginacion'
import { useResponsivePageSize } from '@/presentation/hooks/useResponsivePageSize'
import { EstadoError, EstadoVacio } from '../components/EstadoPagina'
import { Paginacion } from '../components/Paginacion'
import { Button } from '../components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../components/ui/dialog'
import { HojaInferior } from '../components/ui/hoja-inferior'
import { Label, Textarea } from '../components/ui/input'
import { TituloPagina } from '../components/ui/titulo-pagina'
import { useCoincideMedia } from '../components/ui/useCoincideMedia'
import { AccionesAviso, CampoAviso, CuerpoAviso } from './alertas/DetalleAviso'
import { FilaAviso, RESORTE_AVISO } from './alertas/FilaAviso'
import { FrasePendientes } from './alertas/FrasePendientes'
import { IncidentesOperativos } from './alertas/IncidentesOperativos'
import { PestanasEstado } from './alertas/PestanasEstado'
import { accionesDisponibles, ordenarBandeja } from './alertas/bandeja'
import './alertas/alertas.css'

const VACIO_POR_FILTRO: Record<FiltroEstado, string> = {
  pendiente: 'alertas.sinPendientes',
  reconocida: 'alertas.sinRevisadas',
  atendida: 'alertas.sinAtendidas',
  todas: 'alertas.sinAlertas',
}

/* Con poca altura (teléfono en horizontal) dos paneles no caben: lista y hoja, como en vertical. */
const DOS_PANELES = '(min-width: 768px) and (min-height: 560px)'

function EsqueletoBandeja({ dosPaneles }: { dosPaneles: boolean }) {
  const { t } = useTranslation()
  return (
    <div role="status" className="bandeja" data-paneles={dosPaneles ? 2 : 1}>
      <span className="sr-only">{t('app.cargando')}</span>
      <div aria-hidden className="grid gap-2">
        {[0, 1, 2].map((fila) => (
          <div key={fila} className="grid grid-cols-[112px_minmax(0,1fr)] gap-3 p-1.5">
            <div className="esqueleto h-[84px] rounded-(--radius-card)" />
            <div className="space-y-2.5 pt-3">
              <div className="esqueleto h-4 w-2/3 rounded" />
              <div className="esqueleto h-3.5 w-1/3 rounded" />
            </div>
          </div>
        ))}
      </div>
      {dosPaneles && <div aria-hidden className="esqueleto h-[min(62dvh,560px)] rounded-[20px]" />}
    </div>
  )
}

/** Nada pendiente: un campo en calma, del color de «dentro del rango». */
function BandejaAlDia() {
  const { t } = useTranslation()
  return (
    <div role="status" className="bandeja-al-dia">
      <span aria-hidden className="bandeja-al-dia__marca">
        <Check className="size-8" strokeWidth={2.5} />
      </span>
      <p className="bandeja-al-dia__titulo">{t('alertas.sinPendientes')}</p>
      <p className="bandeja-al-dia__detalle">{t('alertas.todoRevisadoDetalle')}</p>
    </div>
  )
}

/**
 * Fuera de «Pendientes» la lista no dice cuántas faltan: este contador las consulta aparte.
 * `version` cambia tras cada acción para volver a contar.
 */
function ConteoPendientes({ version, children }: { version: number; children: (n: number | null) => React.ReactNode }) {
  const { alertas, cargando, errorCarga, reintentar } = useAlertas()
  useEffect(() => {
    if (version > 0) reintentar()
  }, [version, reintentar])
  const n = errorCarga || (cargando && alertas.length === 0) ? null : alertas.filter((alerta) => alerta.estado === 'pendiente').length
  return <>{children(n)}</>
}

export function AlertasPage() {
  const { t } = useTranslation()
  const usuario = useAuthStore((s) => s.usuario)
  const {
    alertas,
    cargando,
    errorCarga,
    reintentar,
    filtro,
    setFiltro,
    reconocerAlerta,
    registrarAccionCorrectiva,
    obtenerCicloAtencion,
    rectificarAccion,
  } = useAlertas()
  const dosPaneles = useCoincideMedia(DOS_PANELES)
  const reducir = useReducedMotion()
  const morfar = dosPaneles && !reducir
  const [pagina, setPagina] = useState(1)
  const tamanoPagina = useResponsivePageSize()
  const ordenadas = useMemo(() => ordenarBandeja(alertas), [alertas])
  // Solo se pinta la página visible: estas listas crecen sin techo.
  const visibles = useMemo(() => ordenadas.slice(...rangoPagina(pagina, tamanoPagina)), [ordenadas, pagina, tamanoPagina])
  const claveOrden = visibles.map((alerta) => alerta.id).join('|')

  // Primero «Refrigerador principal», no su código. Sin nombre registrado, el código.
  const { equipos } = useEstadoOperativo(true)
  const claveNombres = equipos.map((equipo) => `${equipo.id}=${equipo.nombre ?? ''}`).join('|')
  const nombres = useMemo(
    () => new Map(claveNombres.split('|').filter(Boolean).map((par) => par.split('=') as [string, string])),
    [claveNombres],
  )
  const nombreDe = useCallback((deviceId: string) => nombres.get(deviceId) || deviceId, [nombres])

  const [elegidaId, setElegidaId] = useState<string | null>(null)
  const [hojaAbierta, setHojaAbierta] = useState(false)
  const filaOrigen = useRef<HTMLElement | null>(null)
  const titulo = useRef<HTMLSpanElement>(null)
  // Si el aviso elegido sale de la lista (se atendió, cambió de filtro), el panel pasa al siguiente.
  const elegida = ordenadas.find((a) => a.id === elegidaId) ?? (dosPaneles ? (visibles[0] ?? null) : null)

  const [alertaParaAccion, setAlertaParaAccion] = useState<AlertaTermica | null>(null)
  const [descripcionAccion, setDescripcionAccion] = useState('')
  const [guardandoAccion, setGuardandoAccion] = useState(false)
  const [mensajeExito, setMensajeExito] = useState(false)
  // HU-27 Escenario 2: la alerta pudo cambiar de estado entre que se cargó
  // la lista y este click (otro usuario la atendió primero).
  const [conflictoAccion, setConflictoAccion] = useState(false)
  const [conflictoReconocer, setConflictoReconocer] = useState<string | null>(null)
  const [reconociendo, setReconociendo] = useState<string | null>(null)
  const [hecho, setHecho] = useState('')
  const [versionConteo, setVersionConteo] = useState(0)
  // El formulario reemplaza a la hoja en móvil; si se cancela, se vuelve a ella.
  const volverAHoja = useRef(false)

  // HU-23/HU-41: ver `accionesDisponibles`. AUDITOR no aparece en ninguna de las dos listas.
  const puedeReconocer = usuario !== null && tienePermiso(usuario.rol, ['farmaceutico'])
  const puedeRegistrarAccion = usuario !== null && tienePermiso(usuario.rol, ['farmaceutico', 'tecnico'])

  // HU-28 (P5): rectifica su autor o un farmacéutico (el administrador por
  // acceso implícito). El auditor nunca. Solo la versión vigente.
  const puedeRectificar = (accion: AccionCorrectiva) =>
    usuario !== null &&
    accion.vigente !== false &&
    (tienePermiso(usuario.rol, ['farmaceutico']) ||
      (accion.usuario_id === usuario.id && tienePermiso(usuario.rol, ['tecnico'])))

  /** Si la pieza con el foco desapareció (la fila se fue, la hoja se cerró), el foco vuelve al título. */
  const rescatarFoco = () =>
    requestAnimationFrame(() => {
      if (!document.activeElement || document.activeElement === document.body) titulo.current?.focus()
    })

  const cambiarFiltro = (siguiente: FiltroEstado) => {
    setFiltro(siguiente)
    setPagina(1)
    setElegidaId(null)
    setConflictoReconocer(null)
  }

  const cambiarPagina = (siguiente: number) => {
    setPagina(siguiente)
    setElegidaId(null)
  }

  const elegir = useCallback(
    (alerta: AlertaTermica, fila: HTMLElement) => {
      setElegidaId(alerta.id)
      setConflictoReconocer(null)
      setHecho('')
      if (!dosPaneles) {
        filaOrigen.current = fila
        setHojaAbierta(true)
      }
    },
    [dosPaneles],
  )

  const cambiarHoja = (abierta: boolean) => {
    setHojaAbierta(abierta)
    // Sin disparador de Radix el foco se perdería: vuelve a la fila que abrió la hoja.
    if (!abierta) requestAnimationFrame(() => filaOrigen.current?.focus())
  }

  const reconocer = async (alertaId: string) => {
    setConflictoReconocer(null)
    setReconociendo(alertaId)
    try {
      const resultado = await reconocerAlerta(alertaId)
      if (resultado === 'conflicto') setConflictoReconocer(alertaId)
      if (resultado === 'ok') {
        setHecho(t('alertas.marcadaRevisada'))
        setVersionConteo((version) => version + 1)
        // En «Pendientes» la fila se va: en móvil, su hoja también.
        if (!dosPaneles && filtro === 'pendiente') setHojaAbierta(false)
        rescatarFoco()
      }
    } finally {
      setReconociendo(null)
    }
  }

  const abrirAccion = (alerta: AlertaTermica) => {
    volverAHoja.current = !dosPaneles
    setHojaAbierta(false)
    setDescripcionAccion('')
    setMensajeExito(false)
    setConflictoAccion(false)
    setAlertaParaAccion(alerta)
  }

  const cerrarAccion = () => {
    setAlertaParaAccion(null)
    setMensajeExito(false)
    setConflictoAccion(false)
    if (volverAHoja.current) setHojaAbierta(true)
    volverAHoja.current = false
  }

  const guardarAccion = async () => {
    if (!alertaParaAccion || descripcionAccion.trim().length === 0) return
    setGuardandoAccion(true)
    setConflictoAccion(false)
    try {
      const resultado = await registrarAccionCorrectiva(alertaParaAccion.id, descripcionAccion.trim())
      if (resultado === 'ok') {
        setMensajeExito(true)
        setVersionConteo((version) => version + 1)
        volverAHoja.current = false
        setTimeout(() => {
          setAlertaParaAccion(null)
          setDescripcionAccion('')
          setMensajeExito(false)
        }, 1200)
      } else if (resultado === 'conflicto') {
        // HU-27 Escenario 2: otro usuario ya atendió esta alerta. La lista
        // ya se refrescó (dentro del hook); aquí solo se informa por qué
        // este envío en particular no se aplicó.
        setConflictoAccion(true)
      }
    } finally {
      setGuardandoAccion(false)
    }
  }

  const hayAcciones = elegida
    ? Object.values(accionesDisponibles(elegida, puedeReconocer, puedeRegistrarAccion)).some(Boolean)
    : false
  const acciones = elegida && hayAcciones && (
    <AccionesAviso
      alerta={elegida}
      puedeReconocer={puedeReconocer}
      puedeRegistrar={puedeRegistrarAccion}
      reconociendo={reconociendo === elegida.id}
      onReconocer={() => void reconocer(elegida.id)}
      onRegistrar={() => abrirAccion(elegida)}
    />
  )
  const cuerpo = elegida && (
    <CuerpoAviso
      alerta={elegida}
      conflicto={conflictoReconocer === elegida.id}
      obtenerCicloAtencion={obtenerCicloAtencion}
      rectificarAccion={rectificarAccion}
      puedeRectificar={puedeRectificar}
      puedeReconocer={puedeReconocer}
      puedeRegistrar={puedeRegistrarAccion}
    />
  )
  // El aviso que recibió el conflicto pudo salir de la lista: el mensaje no se va con él.
  const conflictoHuerfano = conflictoReconocer !== null && !alertas.some((a) => a.id === conflictoReconocer)

  // Arriba, cuántas faltan. Mientras no se sabe (carga, error) se dice «Alertas», nunca «cero».
  const frase = (n: number | null) =>
    n === null ? (
      t('alertas.titulo')
    ) : (
      <>
        <span className="sr-only">{t('alertas.titulo')}:</span>{' '}
        {n === 0 ? (
          t('alertas.todoRevisado')
        ) : (
          <FrasePendientes n={n} puedeReconocer={puedeReconocer} puedeRegistrar={puedeRegistrarAccion} />
        )}
      </>
    )
  const nPrincipal = errorCarga || (cargando && alertas.length === 0) ? null : alertas.filter((alerta) => alerta.estado === 'pendiente').length

  return (
    <div className="flex flex-1 flex-col">
      <TituloPagina
        antetitulo={t('nav.seccionOperacion')}
        descripcion={t('alertas.descripcion')}
        titulo={
          <span ref={titulo} tabIndex={-1} className="bandeja__titulo">
            {filtro === 'pendiente' ? frase(nPrincipal) : <ConteoPendientes version={versionConteo}>{frase}</ConteoPendientes>}
          </span>
        }
      >
        <PestanasEstado valor={filtro} onCambiar={cambiarFiltro} />
      </TituloPagina>
      <p role="status" className="sr-only">{hecho}</p>

      {conflictoHuerfano && (
        <p role="alert" className="mb-4 rounded-(--radius-field) bg-critical-tint px-3 py-2 text-[13.5px] leading-5 font-medium text-critical">
          {t('alertas.conflictoEstado')}
        </p>
      )}

      {errorCarga ? (
        <EstadoError mensaje={t('alertas.errorCargar')} onReintentar={reintentar} />
      ) : cargando && alertas.length === 0 ? (
        <EsqueletoBandeja dosPaneles={dosPaneles} />
      ) : alertas.length === 0 ? (
        <>
          {filtro === 'pendiente' ? <BandejaAlDia /> : <EstadoVacio icono={BellOff} titulo={t(VACIO_POR_FILTRO[filtro])} llenar />}
          <IncidentesOperativos nombreDe={nombreDe} />
        </>
      ) : (
        <div className="bandeja" data-paneles={dosPaneles ? 2 : 1}>
          <div className="min-w-0">
            <ul aria-label={t('alertas.titulo')} aria-busy={cargando || undefined} className="bandeja__lista">
              {/* Una alerta revisada se va con suavidad y las de abajo suben a su sitio. */}
              <AnimatePresence initial={false} mode="popLayout">
                {visibles.map((alerta) => (
                  <motion.li
                    key={alerta.id}
                    layout={reducir ? false : 'position'}
                    layoutDependency={claveOrden}
                    initial={reducir ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0, x: 0 }}
                    exit={reducir ? undefined : { opacity: 0, x: -20, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }}
                    transition={reducir ? { duration: 0 } : RESORTE_AVISO}
                  >
                    <FilaAviso
                      alerta={alerta}
                      nombre={nombreDe(alerta.device_id)}
                      elegida={dosPaneles && elegida?.id === alerta.id}
                      abreHoja={!dosPaneles}
                      morfar={morfar}
                      mostrarEstado={filtro === 'todas'}
                      onElegir={elegir}
                    />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
            <Paginacion total={ordenadas.length} pagina={pagina} onCambiar={cambiarPagina} tamano={tamanoPagina} />
            <IncidentesOperativos nombreDe={nombreDe} />
          </div>

          {dosPaneles && elegida && (
            <aside aria-label={t('alertas.detalleDe', { equipo: nombreDe(elegida.device_id) })} className="pane-aviso">
              <CampoAviso alerta={elegida} nombre={nombreDe(elegida.device_id)} morfar={morfar} />
              <div key={`${elegida.id}-${elegida.estado}`} tabIndex={0} className="pane-aviso__cuerpo">
                {cuerpo}
              </div>
              {/* La acción principal, siempre a la vista aunque «Ver más» se alargue. */}
              {acciones && <div className="pane-aviso__acciones">{acciones}</div>}
            </aside>
          )}
        </div>
      )}

      {!dosPaneles && (
        <HojaInferior
          abierta={hojaAbierta && elegida !== null}
          onCambiar={cambiarHoja}
          titulo={elegida ? t('alertas.detalleDe', { equipo: nombreDe(elegida.device_id) }) : t('alertas.titulo')}
          ocultarTitulo
          pie={acciones || undefined}
          className="hoja-aviso"
        >
          {elegida && <CampoAviso alerta={elegida} nombre={nombreDe(elegida.device_id)} />}
          {elegida && <div key={`${elegida.id}-${elegida.estado}`}>{cuerpo}</div>}
        </HojaInferior>
      )}

      {/* ── Diálogo de acción correctiva ────────────────────── */}
      <Dialog open={alertaParaAccion !== null} onOpenChange={(abierto) => !abierto && cerrarAccion()}>
        <DialogContent>
          <DialogTitle>{t('alertas.registrarAccion')}</DialogTitle>
          <DialogDescription>{alertaParaAccion?.mensaje}</DialogDescription>
          <div className="mt-4 space-y-3">
            <div>
              <Label htmlFor="accion-descripcion">{t('alertas.etiquetaAccion')}</Label>
              <Textarea
                id="accion-descripcion"
                value={descripcionAccion}
                onChange={(e) => setDescripcionAccion(e.target.value)}
                placeholder={t('alertas.descripcionAccionPlaceholder')}
                maxLength={2000}
                aria-describedby="accion-ayuda"
              />
              <p id="accion-ayuda" className="mt-1 text-xs text-muted">
                {t('alertas.descripcionAccionAyuda')}
              </p>
            </div>
            {mensajeExito && (
              <p role="status" className="rounded-(--radius-field) bg-success-100 px-3 py-2 text-[13px] text-success-700">
                {t('alertas.accionRegistrada')}
              </p>
            )}
            {conflictoAccion && (
              <p role="alert" className="rounded-(--radius-field) bg-critical-tint px-3 py-2 text-[13px] font-medium text-critical">
                {t('alertas.conflictoEstado')}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
              <Button variant="ghost" onClick={cerrarAccion} disabled={guardandoAccion}>
                {t('comunes.cancelar')}
              </Button>
              <Button onClick={() => void guardarAccion()} disabled={guardandoAccion || descripcionAccion.trim().length === 0}>
                {guardandoAccion ? t('alertas.guardando') : t('alertas.guardarAccion')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
