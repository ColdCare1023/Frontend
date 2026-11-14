import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { CircleCheck } from 'lucide-react'

import type { ResultadoAccionAlerta, ResultadoRectificacion } from '@/application/hooks/useAlertas'
import type { AccionCorrectiva, AlertaTermica } from '@/domain/entities/AlertaTermica'
import { fechaHora } from '@/lib/formato'
import { RiskBadge } from '../../components/RiskBadge'
import { Button } from '../../components/ui/button'
import { PuntoEstado } from '../../components/ui/estado'
import { PanelPestana, Pestanas } from '../../components/ui/pestanas'
import {
  SidePanel,
  SidePanelBody,
  SidePanelContent,
  SidePanelDescription,
  SidePanelFooter,
  SidePanelHeader,
  SidePanelTitle,
} from '../../components/ui/side-panel'
import { CronologiaAtencion } from './CronologiaAtencion'
import { EvidenciaPanel } from './EvidenciaAlerta'
import { FormularioAccionCorrectiva } from './FormularioAccionCorrectiva'
import { BORRADOR_VACIO, type BorradorAccion, type PestanaPanel, type PuedeRectificar } from './tipos'

/** «Registrada» se ve un instante antes de pasar a la cronología. */
const PAUSA_REGISTRADA_MS = 600

const TONO_ESTADO = { pendiente: 'neutro', reconocida: 'neutro', atendida: 'normal' } as const

export interface PropsPanelAlerta {
  alerta: AlertaTermica | null
  pestanaInicial: PestanaPanel
  /** Acción disponible para este rol (la página ya aplicó el RBAC). */
  puedeRegistrar: boolean
  puedeRectificar: PuedeRectificar
  borradores: Map<string, BorradorAccion>
  onCerrar: () => void
  /** Devuelve el foco (al disparador o, si ya no existe, a un destino estable). */
  onDevolverFoco: () => void
  registrarAccion: (alertaId: string, datos: BorradorAccion) => Promise<ResultadoAccionAlerta>
  obtenerCiclo: (alertaId: string) => Promise<AccionCorrectiva[]>
  rectificarAccion?: (accionId: string, descripcion: string, motivo: string) => Promise<ResultadoRectificacion>
}

/**
 * Panel lateral de una alerta (Cult UI Side Panel, 480 px; pantalla completa
 * en móvil): evidencia arriba y dos pestañas, «Acción correctiva» y
 * «Cronología». Deja la lista visible detrás; la fila que lo abrió queda
 * seleccionada y recupera el foco al cerrar (continuidad espacial).
 */
export function PanelAlerta(props: PropsPanelAlerta) {
  const { alerta, pestanaInicial, onCerrar, onDevolverFoco } = props
  return (
    <SidePanel open={alerta !== null} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <SidePanelContent
        data-panel-alerta=""
        className="max-sm:max-w-none"
        onOpenAutoFocus={(evento) => {
          evento.preventDefault()
          // Acción: primer campo. Cronología: la pestaña activa o, sin pestañas, su título.
          const destino =
            (pestanaInicial === 'accion' ? document.getElementById('accion-decision') : null) ??
            document.querySelector<HTMLElement>('[data-panel-alerta] [role="tab"][aria-selected="true"]') ??
            document.querySelector<HTMLElement>('[data-panel-alerta] [data-foco-cronologia]')
          destino?.focus()
        }}
        onCloseAutoFocus={(evento) => {
          evento.preventDefault()
          onDevolverFoco()
        }}
      >
        {alerta && <ContenidoPanel key={alerta.id} {...props} alerta={alerta} />}
      </SidePanelContent>
    </SidePanel>
  )
}

function ContenidoPanel({
  alerta,
  pestanaInicial,
  puedeRegistrar,
  puedeRectificar,
  borradores,
  onCerrar,
  registrarAccion,
  obtenerCiclo,
  rectificarAccion,
}: PropsPanelAlerta & { alerta: AlertaTermica }) {
  const { t } = useTranslation()
  const idBase = useId()
  // La pestaña Acción existe si el rol puede registrar y la alerta no estaba
  // atendida al abrir; tras registrar desaparece (la alerta ya está atendida).
  const [conAccion, setConAccion] = useState(puedeRegistrar && alerta.estado !== 'atendida')
  const [pestana, setPestana] = useState<PestanaPanel>(conAccion ? pestanaInicial : 'cronologia')
  const [direccion, setDireccion] = useState<1 | -1>(1)
  const [registrada, setRegistrada] = useState(false)
  const [borrador, setBorrador] = useState<BorradorAccion>(() => borradores.get(alerta.id) ?? BORRADOR_VACIO)
  const temporizador = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (temporizador.current !== null) window.clearTimeout(temporizador.current)
    },
    [],
  )

  const cambiarPestana = (siguiente: PestanaPanel) => {
    setDireccion(siguiente === 'cronologia' ? 1 : -1)
    setPestana(siguiente)
  }

  const actualizarBorrador = (siguiente: BorradorAccion) => {
    setBorrador(siguiente)
    borradores.set(alerta.id, siguiente)
  }

  const alRegistrar = () => {
    borradores.delete(alerta.id)
    setRegistrada(true)
    temporizador.current = window.setTimeout(() => {
      temporizador.current = null
      setConAccion(false)
      setDireccion(1)
      setPestana('cronologia')
    }, PAUSA_REGISTRADA_MS)
  }

  const cronologia = (
    <>
      <SidePanelBody className="space-y-4 px-4 py-4 sm:px-6 sm:py-5">
        {registrada && (
          <p
            role="status"
            className="flex items-center gap-2 rounded-(--radius-field) bg-success-100 px-3 py-2 text-body text-success-700"
          >
            <CircleCheck aria-hidden className="size-4 shrink-0" />
            {t('alertas.accionRegistrada')}
          </p>
        )}
        <CronologiaAtencion
          alerta={alerta}
          obtenerCiclo={obtenerCiclo}
          rectificarAccion={rectificarAccion}
          puedeRectificar={puedeRectificar}
          resaltarNueva={registrada}
        />
      </SidePanelBody>
      <SidePanelFooter className="items-stretch px-4 sm:items-center sm:justify-between sm:px-6">
        <Link
          to="/historial"
          onClick={onCerrar}
          className="inline-flex min-h-11 items-center justify-center rounded-(--radius-field) text-body font-medium text-primary-text underline decoration-primary/40 underline-offset-4 transition-colors duration-(--duration-micro) hover:decoration-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:min-h-9"
        >
          {t('alertas.panel.verHistorial')}
        </Link>
        <Button variant="ghost" onClick={onCerrar}>
          {t('comunes.cerrar')}
        </Button>
      </SidePanelFooter>
    </>
  )

  return (
    <>
      <SidePanelHeader className="border-b-0 px-4 pt-4 pb-0 pr-14 sm:px-6 sm:pt-5">
        <div className="flex flex-wrap items-center gap-2">
          <RiskBadge nivel={alerta.nivel_riesgo} />
          <span className="inline-flex items-center gap-1.5 text-meta text-muted">
            <PuntoEstado tono={TONO_ESTADO[alerta.estado]} />
            {t(`alertas.estadoAlerta.${alerta.estado}`)}
          </span>
        </div>
        <SidePanelTitle className="mt-2 text-balance">{alerta.mensaje}</SidePanelTitle>
        <SidePanelDescription className="nums mt-1 text-meta text-faint">
          <span className="codigo">{alerta.device_id}</span> · {fechaHora(alerta.created_at)}
        </SidePanelDescription>
        <EvidenciaPanel alerta={alerta} />
        {conAccion ? (
          <Pestanas
            className="mt-4 -mx-1"
            idBase={idBase}
            etiqueta={t('alertas.panel.secciones')}
            valor={pestana}
            onCambiar={cambiarPestana}
            pestanas={[
              { valor: 'accion', etiqueta: t('alertas.accionCorrectiva') },
              { valor: 'cronologia', etiqueta: t('alertas.panel.tabCronologia') },
            ]}
          />
        ) : (
          <h3 data-foco-cronologia tabIndex={-1} className="mt-4 border-b border-border pb-3 text-title text-foreground focus-visible:outline-none">
            {t('alertas.cicloAtencion')}
          </h3>
        )}
      </SidePanelHeader>
      {conAccion ? (
        <PanelPestana idBase={idBase} valor={pestana} direccion={direccion} className="flex min-h-0 flex-1 flex-col">
          {pestana === 'accion' ? (
            <FormularioAccionCorrectiva
              borrador={borrador}
              onBorrador={actualizarBorrador}
              onGuardar={(datos) => registrarAccion(alerta.id, datos)}
              onCancelar={() => {
                borradores.delete(alerta.id)
                onCerrar()
              }}
              onRegistrada={alRegistrar}
              onVerCronologia={() => cambiarPestana('cronologia')}
            />
          ) : (
            cronologia
          )}
        </PanelPestana>
      ) : (
        cronologia
      )}
    </>
  )
}
