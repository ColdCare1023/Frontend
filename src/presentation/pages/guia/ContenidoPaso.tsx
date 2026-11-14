import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ArrowRight, Bell, CircleCheck, History, Hourglass, Monitor, OctagonAlert, ShieldCheck, TriangleAlert } from 'lucide-react'

import { tienePermiso, type Rol } from '@/domain/value-objects/Rol'
import { cn } from '@/lib/utils'
import { Badge } from '../../components/ui/badge'
import { formatearTemperatura } from '../../components/ui/formato-cifra'
import { Regla } from '../../components/ui/regla'
import { CONCEPTOS, GRUPOS, SECCIONES, type PasoId } from './contenidoGuia'

const ENLACE = 'inline-flex items-center gap-1 text-meta font-medium text-primary-text underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded-sm'

function Rutina() {
  const { t } = useTranslation()
  const pasos = [
    ['monitoreo', Monitor, '/dashboard', 'guia.pantallas.monitoreo.titulo'],
    ['alerta', Bell, '/alertas', 'guia.pantallas.alertas.titulo'],
    ['historial', History, '/historial', 'guia.pantallas.historial.titulo'],
  ] as const
  return (
    <ol className="grid gap-4 sm:grid-cols-3">
      {pasos.map(([paso, Icono, ruta, pantalla], i) => (
        <li key={paso} className="flex flex-col gap-1">
          <span className="flex items-center gap-2">
            <span className="nums text-meta text-faint">{String(i + 1).padStart(2, '0')}</span>
            <Icono aria-hidden className="size-[18px] text-faint" />
          </span>
          <h3 className="text-body font-semibold text-foreground">{t(`guia.pasos.${paso}.titulo`)}</h3>
          <p className="text-meta text-muted">{t(`guia.pasos.${paso}.descripcion`)}</p>
          <Link to={ruta} className={ENLACE}>
            {t('guia.abrirPantalla', { pantalla: t(pantalla) })}
            <ArrowRight aria-hidden className="size-3.5" />
          </Link>
        </li>
      ))}
    </ol>
  )
}

function Estados() {
  const { t } = useTranslation()
  const estados = [
    ['normal', CircleCheck, 'text-success-700'],
    ['preventivo', TriangleAlert, 'text-warning-700'],
    ['critico', OctagonAlert, 'text-critical'],
    ['sinDatos', Hourglass, 'text-nodata-700'],
  ] as const
  return (
    <>
      <div role="img" aria-label={t('guia.reglaAria')} className="grid gap-4 sm:grid-cols-2">
        {([
          [4.3, 'normal'],
          [8.4, 'critico'],
        ] as const).map(([valor, tono]) => (
          <div key={valor} className="min-w-0">
            <p className="nums text-title text-foreground">{formatearTemperatura(valor)}</p>
            <Regla valor={valor} tono={tono} tamano="m" cotas decorativa className="mt-1" />
          </div>
        ))}
      </div>
      <ul className="mt-4 divide-y divide-border">
        {estados.map(([clave, Icono, color]) => (
          <li key={clave} className="flex gap-3 py-3">
            <Icono aria-hidden className={cn('mt-0.5 size-4 shrink-0', color)} />
            <div className="min-w-0">
              <h3 className="flex items-center gap-2 text-body font-semibold text-foreground">
                {t(`guia.estados.${clave}.titulo`)}
                {clave === 'sinDatos' && <span aria-hidden className="trama-sin-datos size-3 rounded-sm" />}
              </h3>
              <p className="text-meta text-muted">{t(`guia.estados.${clave}.descripcion`)}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-meta text-faint">{t('guia.rangoNota')}</p>
    </>
  )
}

function Alertas() {
  const { t } = useTranslation()
  return (
    <>
      <ol className="grid gap-4 sm:grid-cols-3">
        {(['revisar', 'actuar', 'registrar'] as const).map((paso, i) => (
          <li key={paso} className="flex gap-3 sm:flex-col sm:gap-2">
            <span className="nums flex size-7 shrink-0 items-center justify-center rounded-full border border-border-strong text-meta font-semibold text-muted">
              {String(i + 1).padStart(2, '0')}
            </span>
            <div className="min-w-0">
              <h3 className="text-body font-semibold text-foreground">{t(`guia.alertaPasos.${paso}.titulo`)}</h3>
              <p className="text-meta text-muted">{t(`guia.alertaPasos.${paso}.descripcion`)}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-4 rounded-(--radius-card) border border-border p-3">
        <p className="eyebrow">{t('guia.ejemploTitulo')}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="nums text-title text-foreground">{formatearTemperatura(8.4)}</span>
          <Regla valor={8.4} tono="critico" tamano="s" decorativa />
          <Badge variant="critical">{t('riesgo.excursion_critica')}</Badge>
        </div>
        <p className="mt-2 text-meta text-muted">{t('guia.ejemplo')}</p>
      </div>
      <p className="mt-3 flex gap-2 text-meta text-muted">
        <ShieldCheck aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        {t('guia.alertaPermisos')}
      </p>
    </>
  )
}

function Pantallas({ rol }: { rol: Rol | undefined }) {
  const { t } = useTranslation()
  const visibles = SECCIONES.filter((s) => (rol ? tienePermiso(rol, s.roles) : false))
  const grupos = GRUPOS.map((grupo) => ({ grupo, secciones: visibles.filter((s) => s.grupo === grupo) })).filter(
    ({ secciones }) => secciones.length > 0,
  )
  return (
    <div className="space-y-4">
      {grupos.map(({ grupo, secciones }) => (
        <div key={grupo}>
          <h3 className="eyebrow">{t(`guia.grupos.${grupo}`)}</h3>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {secciones.map((s) => {
              const Icono = s.icono
              return (
                <li key={s.ruta} className="min-w-0">
                  <Link
                    to={s.ruta}
                    className="group flex min-h-14 items-start gap-3 rounded-(--radius-field) p-3 transition-colors duration-(--duration-micro) ease-(--ease-hover) hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <Icono aria-hidden className="mt-0.5 size-[18px] shrink-0 text-faint" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-body font-medium text-foreground underline-offset-4 group-hover:underline">{t(s.tituloKey)}</span>
                      <span className="block text-meta text-muted">{t(s.descripcionKey)}</span>
                    </span>
                    <ArrowRight
                      aria-hidden
                      className="mt-0.5 size-4 shrink-0 text-faint transition-transform duration-(--duration-micro) group-hover:translate-x-0.5"
                    />
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

function Conceptos() {
  const { t } = useTranslation()
  return (
    <dl className="grid gap-x-6 sm:grid-cols-2">
      {CONCEPTOS.map((c) => (
        <div key={c} className="border-b border-border py-3">
          <dt className="text-body font-semibold text-foreground">{t(`guia.conceptos.${c}.titulo`)}</dt>
          <dd className="text-meta text-muted">{t(`guia.conceptos.${c}.descripcion`)}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Contenido de cada paso de la guía. */
export function ContenidoPaso({ paso, rol }: { paso: PasoId; rol: Rol | undefined }) {
  if (paso === 'inicio') return <Rutina />
  if (paso === 'estados') return <Estados />
  if (paso === 'alertas') return <Alertas />
  if (paso === 'pantallas') return <Pantallas rol={rol} />
  return <Conceptos />
}
