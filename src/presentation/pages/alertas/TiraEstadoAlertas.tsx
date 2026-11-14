import { useTranslation } from 'react-i18next'
import { CircleCheck, CircleHelp, ClipboardPen, Hourglass, OctagonAlert, TriangleAlert } from 'lucide-react'

import { duracionLegible, fechaHoraCompacta, haceCuanto } from '@/lib/formato'
import { Esqueleto } from '../../components/ui/esqueleto'
import { TiraEstado, type SegmentoTira } from '../../components/ui/tira-estado'
import { textoConteo } from '../../components/ui/formato-cifra'
import type { ResumenBandeja } from './logica'

/**
 * Tira de estado de Alertas (DIRECTION §5.1): una frase guía con el foco del
 * momento y 2–4 cifras. Si el resumen no está disponible muestra «—», nunca
 * 0: un cero sería un falso «todo en orden».
 */
export function TiraEstadoAlertas({
  resumen,
  incidentesActivos,
  estado,
  atendidasDisponibles,
  ahora,
}: {
  resumen: ResumenBandeja | null
  incidentesActivos: number | null
  estado: 'cargando' | 'listo' | 'error'
  /** Falló la GET de atendidas: sus dos cifras no se informan como 0. */
  atendidasDisponibles: boolean
  ahora: number
}) {
  const { t } = useTranslation()
  const noDisponible = (
    <span title={t('alertas.resumen.noDisponible')}>
      <span aria-hidden>—</span>
      <span className="sr-only">{t('alertas.resumen.noDisponible')}</span>
    </span>
  )
  const valor = (contenido: React.ReactNode) =>
    estado === 'cargando' ? <Esqueleto className="my-0.5 h-6 w-10" /> : estado === 'error' || !resumen ? noDisponible : contenido

  const segmentos: SegmentoTira[] = [
    {
      clave: 'criticas',
      etiqueta: t('alertas.resumen.criticasAbiertas'),
      valor: valor(resumen?.criticasAbiertas),
      tono: estado === 'listo' && (resumen?.criticasAbiertas ?? 0) > 0 ? 'critico' : 'neutro',
    },
    {
      clave: 'incidentes',
      etiqueta: t('alertas.resumen.incidentesActivos'),
      valor:
        incidentesActivos === null ? (
          noDisponible
        ) : (
          <a
            href="#incidentes-operativos"
            className="rounded-sm underline decoration-border-strong underline-offset-4 hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            {incidentesActivos}
          </a>
        ),
    },
    {
      clave: 'atendidas7d',
      etiqueta: t('alertas.resumen.atendidas7d'),
      valor: atendidasDisponibles
        ? valor(resumen ? textoConteo(resumen.atendidas7d, resumen.atendidas7dTruncado) : null)
        : noDisponible,
      className: 'hidden lg:flex',
    },
    {
      clave: 'atencion',
      etiqueta: t('alertas.resumen.atencionMedia'),
      valor: atendidasDisponibles
        ? valor(resumen?.atencionMedia7d != null ? duracionLegible(resumen.atencionMedia7d) : '—')
        : noDisponible,
      className: 'hidden lg:flex',
    },
  ]

  return (
    <TiraEstado
      etiqueta={t('alertas.resumen.titulo')}
      className="mb-3 xl:mb-4"
      segmentos={segmentos}
      guia={<FraseGuia resumen={resumen} incidentesActivos={incidentesActivos ?? 0} estado={estado} ahora={ahora} />}
    />
  )
}

function FraseGuia({
  resumen,
  incidentesActivos,
  estado,
  ahora,
}: {
  resumen: ResumenBandeja | null
  incidentesActivos: number
  estado: 'cargando' | 'listo' | 'error'
  ahora: number
}) {
  const { t } = useTranslation()
  if (estado === 'cargando') return <Esqueleto className="h-4 w-64 max-w-full" />
  const clase = 'flex min-w-0 items-center gap-2 text-pretty'
  if (estado === 'error' || !resumen) {
    return (
      <span className={clase}>
        <CircleHelp aria-hidden className="size-4 shrink-0 text-faint" />
        {t('alertas.guia.error')}
      </span>
    )
  }
  const fecha = fechaHoraCompacta(resumen.masAntigua)
  if (resumen.criticasAbiertas > 0) {
    return (
      <span className={clase}>
        <OctagonAlert aria-hidden className="size-4 shrink-0 text-critical" />
        {t('alertas.guia.criticas', { count: resumen.criticasAbiertas, fecha })}
      </span>
    )
  }
  if (resumen.pendientes > 0) {
    return (
      <span className={clase}>
        <TriangleAlert aria-hidden className="size-4 shrink-0 text-warning-600" />
        {t('alertas.guia.pendientes', { count: resumen.pendientes, fecha })}
      </span>
    )
  }
  if (incidentesActivos > 0) {
    return (
      <span className={clase}>
        <Hourglass aria-hidden className="size-4 shrink-0 text-faint" />
        {t('alertas.guia.incidentes', { count: incidentesActivos })}
      </span>
    )
  }
  if (resumen.revisadas > 0) {
    return (
      <span className={clase}>
        <ClipboardPen aria-hidden className="size-4 shrink-0 text-muted" />
        {t('alertas.guia.revisadas', { count: resumen.revisadas })}
      </span>
    )
  }
  return (
    <span className={clase}>
      <CircleCheck aria-hidden className="size-4 shrink-0 text-success-600" />
      {resumen.ultimaAtendida
        ? t('alertas.guia.enOrden', { hace: haceCuanto(resumen.ultimaAtendida.atendida_en, ahora) })
        : t('alertas.guia.enOrdenSinHistorial')}
    </span>
  )
}
