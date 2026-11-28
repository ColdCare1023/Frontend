import { useCallback, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bell, Check, ChevronRight, OctagonAlert, TriangleAlert } from 'lucide-react'

import type { useAlertasPendientes } from '@/application/hooks/useAlertasPendientes'
import { LIMITE_ALERTAS } from '@/application/hooks/useAlertas'
import { useAuthStore } from '@/application/stores/authStore'
import type { AlertaTermica } from '@/domain/entities/AlertaTermica'
import { tienePermiso } from '@/domain/value-objects/Rol'
import { fechaHoraCompacta } from '@/lib/formato'
import { Button } from '../../components/ui/button'
import { formatearTemperatura } from '../../components/ui/formato-cifra'
import { PanelAlerta } from '../alertas/PanelAlerta'
import { puedeRectificarAccion, type BorradorAccion } from '../alertas/tipos'

const FILAS_INICIALES = 3

interface Props {
  bandeja: ReturnType<typeof useAlertasPendientes>
  nombres: ReadonlyMap<string, string>
}

export function BandejaAlertasOperativa({ bandeja, nombres }: Props) {
  const { t } = useTranslation()
  const usuario = useAuthStore((s) => s.usuario)
  const puedeAtender = usuario !== null && tienePermiso(usuario.rol, ['farmaceutico'])
  const tituloId = useId()
  const cabecera = useRef<HTMLHeadingElement>(null)
  const origen = useRef<HTMLButtonElement | null>(null)
  const borradores = useRef(new Map<string, BorradorAccion>())
  const [filasVisibles, setFilasVisibles] = useState(FILAS_INICIALES)
  const [abierta, setAbierta] = useState<AlertaTermica | null>(null)
  const lista = bandeja.alertas
  const ultimaAtendida = bandeja.ultimaAtendidaLocal
  const seleccionada = lista.find((a) => a.id === abierta?.id) ??
    (ultimaAtendida?.id === abierta?.id ? ultimaAtendida : null) ?? abierta
  const limite = ['pendiente', 'reconocida'].some((estado) => lista.filter((a) => a.estado === estado).length >= LIMITE_ALERTAS)

  const devolverFoco = useCallback(() => {
    const destino = origen.current?.isConnected ? origen.current : cabecera.current
    destino?.focus({ preventScroll: true })
  }, [])

  function fila(alerta: AlertaTermica) {
    const critica = alerta.nivel_riesgo === 'excursion_critica'
    const Icono = critica ? OctagonAlert : TriangleAlert
    const equipo = nombres.get(alerta.device_id) || alerta.device_id
    const fecha = alerta.iniciada_en ?? alerta.created_at
    return (
      <li key={alerta.id} className="flex min-w-0 items-center gap-2.5 py-2.5">
        <Icono aria-hidden className={critica ? 'size-4 shrink-0 text-critical' : 'size-4 shrink-0 text-warning-700'} />
        <div className="min-w-0 flex-1">
          <p className="break-words text-body font-semibold text-foreground">{equipo}</p>
          <p className="flex flex-wrap items-baseline gap-x-1 text-meta text-muted">
            <span>{t(`riesgo.${alerta.nivel_riesgo}`)}</span>
            {alerta.temperatura_pico != null && <span className="nums">· {formatearTemperatura(alerta.temperatura_pico)}</span>}
            {fecha && <time className="nums" dateTime={fecha}>· {fechaHoraCompacta(fecha)}</time>}
            {alerta.estado === 'reconocida' && <span>· {t('alertas.estadoAlerta.reconocida')}</span>}
          </p>
        </div>
        <Button
          variant="secondary" size="sm" className="shrink-0" aria-haspopup="dialog"
          onClick={(e) => { origen.current = e.currentTarget; setAbierta(alerta) }}
        >
          {t(puedeAtender ? 'dashboard.bandejaAtender' : 'comunes.verDetalleFila')}
          <span className="sr-only"> — {equipo}{fecha && `, ${fechaHoraCompacta(fecha)}`}</span>
          <ChevronRight aria-hidden className="size-3.5" />
        </Button>
      </li>
    )
  }

  return (
    <section aria-labelledby={tituloId} className="min-w-0">
      <h2 id={tituloId} ref={cabecera} tabIndex={-1} className="flex items-center gap-2 text-title font-semibold text-foreground">
        <Bell aria-hidden className="size-4 shrink-0 text-muted" /> {t('dashboard.alertasTitulo')}
        {bandeja.estado === 'listo' && lista.length > 0 && <span className="nums text-meta font-medium text-muted">({lista.length}{limite ? '+' : ''})</span>}
      </h2>
      {bandeja.estado === 'cargando' && <p role="status" className="mt-2 text-meta text-muted">{t('app.cargando')}</p>}
      {bandeja.estado === 'error' && (
        <div role="alert" className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-body text-critical">{t('dashboard.alertasError')}</span>
          <Button variant="secondary" size="sm" onClick={bandeja.reintentar}>{t('comunes.reintentar')}</Button>
        </div>
      )}
      {bandeja.estado === 'listo' && (lista.length === 0 ? (
        <p className="mt-2 flex items-center gap-2 text-body text-muted"><Check aria-hidden className="size-4 text-success-700" />{t('dashboard.todoEnOrdenDetalle')}</p>
      ) : (
        <>
          <ul className="mt-1 divide-y divide-border">{lista.slice(0, filasVisibles).map(fila)}</ul>
          {lista.length > FILAS_INICIALES && (
            <div className="border-t border-border">
              {lista.length > filasVisibles ? (
                <Button variant="ghost" size="sm" onClick={() => setFilasVisibles((n) => n + FILAS_INICIALES)}>
                  {t('dashboard.bandejaMas', { count: lista.length - filasVisibles })}
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setFilasVisibles(FILAS_INICIALES)}>{t('comunes.ocultarDetalles')}</Button>
              )}
            </div>
          )}
          {limite && <p className="text-meta text-muted">{t('dashboard.bandejaLimite', { count: lista.length, limite: LIMITE_ALERTAS })}</p>}
        </>
      ))}
      <PanelAlerta
        alerta={seleccionada} pestanaInicial={puedeAtender ? 'accion' : 'cronologia'}
        puedeRegistrar={puedeAtender} puedeRectificar={(accion) => puedeRectificarAccion(usuario, accion)}
        reconocer={puedeAtender ? bandeja.reconocerAlerta : undefined}
        mostrarEnlaceHistorial={false}
        borradores={borradores.current} onCerrar={() => setAbierta(null)} onDevolverFoco={devolverFoco}
        registrarAccion={bandeja.registrarAccionCorrectiva}
        obtenerCiclo={bandeja.obtenerCicloAtencion} rectificarAccion={bandeja.rectificarAccion}
      />
    </section>
  )
}
