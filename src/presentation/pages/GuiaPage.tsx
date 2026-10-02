import { CompactWorkspace } from '../components/CompactWorkspace'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import {
  ArrowRight,
  Bell,
  BookOpenText,
  CircleDot,
  CircleAlert,
  CircleCheck,
  FileText,
  History,
  Info,
  Link2,
  ListChecks,
  Monitor,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  type LucideIcon,
} from 'lucide-react'

import { useAuthStore } from '@/application/stores/authStore'
import { tienePermiso, type Rol } from '@/domain/value-objects/Rol'
import { PageHeader } from '../components/PageHeader'
import { REOPEN_TOUR_EVENT } from '../components/OnboardingTour'

type GrupoId = 'vigilar' | 'consultar' | 'administrar'

interface Seccion {
  ruta: string
  icono: LucideIcon
  tituloKey: string
  descripcionKey: string
  grupo: GrupoId
  roles: Rol[]
}

const SECCIONES: Seccion[] = [
  {
    ruta: '/dashboard',
    icono: Monitor,
    tituloKey: 'guia.pantallas.monitoreo.titulo',
    descripcionKey: 'guia.pantallas.monitoreo.descripcion',
    grupo: 'vigilar',
    roles: ['farmaceutico', 'tecnico', 'auditor'],
  },
  {
    ruta: '/alertas',
    icono: Bell,
    tituloKey: 'guia.pantallas.alertas.titulo',
    descripcionKey: 'guia.pantallas.alertas.descripcion',
    grupo: 'vigilar',
    roles: ['farmaceutico', 'tecnico', 'auditor'],
  },
  {
    ruta: '/historial',
    icono: History,
    tituloKey: 'guia.pantallas.historial.titulo',
    descripcionKey: 'guia.pantallas.historial.descripcion',
    grupo: 'consultar',
    roles: ['farmaceutico', 'tecnico', 'auditor'],
  },
  {
    ruta: '/trazabilidad',
    icono: Link2,
    tituloKey: 'guia.pantallas.integridad.titulo',
    descripcionKey: 'guia.pantallas.integridad.descripcion',
    grupo: 'consultar',
    roles: ['farmaceutico', 'tecnico', 'auditor'],
  },
  {
    ruta: '/reportes',
    icono: FileText,
    tituloKey: 'guia.pantallas.reportes.titulo',
    descripcionKey: 'guia.pantallas.reportes.descripcion',
    grupo: 'consultar',
    roles: ['farmaceutico', 'auditor'],
  },
  {
    ruta: '/metricas-ia',
    icono: ListChecks,
    tituloKey: 'guia.pantallas.metricas.titulo',
    descripcionKey: 'guia.pantallas.metricas.descripcion',
    grupo: 'consultar',
    roles: ['farmaceutico', 'auditor'],
  },
  {
    ruta: '/auditoria',
    icono: ScrollText,
    tituloKey: 'guia.pantallas.auditoria.titulo',
    descripcionKey: 'guia.pantallas.auditoria.descripcion',
    grupo: 'consultar',
    roles: ['auditor'],
  },
  {
    ruta: '/usuarios',
    icono: Users,
    tituloKey: 'guia.pantallas.usuarios.titulo',
    descripcionKey: 'guia.pantallas.usuarios.descripcion',
    grupo: 'administrar',
    roles: [],
  },
  {
    ruta: '/dispositivos',
    icono: SlidersHorizontal,
    tituloKey: 'guia.pantallas.dispositivos.titulo',
    descripcionKey: 'guia.pantallas.dispositivos.descripcion',
    grupo: 'administrar',
    roles: [],
  },
]

const GRUPOS: GrupoId[] = ['vigilar', 'consultar', 'administrar']

const CONCEPTOS = ['rango', 'preventivo', 'excursion', 'integridad', 'bpa'] as const
const ANCLAS = {
  inicio: 'guia-inicio-titulo',
  estados: 'guia-estados-titulo',
  alertas: 'guia-alerta-titulo',
  pantallas: 'guia-pantallas-titulo',
  dudas: 'guia-preguntas-titulo',
} as const

function Paso({
  numero,
  titulo,
  descripcion,
  icono: Icono,
  ultimo = false,
}: {
  numero: number
  titulo: string
  descripcion: string
  icono: LucideIcon
  ultimo?: boolean
}) {
  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {!ultimo && <span aria-hidden className="absolute left-[15px] top-9 h-[calc(100%-2.25rem)] w-px bg-border" />}
      <span className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-primary">
        <Icono aria-hidden className="size-4" />
      </span>
      <div className="min-w-0 pt-0.5">
        <p className="text-sm font-semibold text-foreground">
          <span className="nums mr-1.5 text-muted">{numero}.</span>
          {titulo}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted">{descripcion}</p>
      </div>
    </li>
  )
}

export function GuiaPage() {
  const { t } = useTranslation()
  const usuario = useAuthStore((s) => s.usuario)
  const rol = usuario?.rol
  const visibles = SECCIONES.filter((s) => (rol ? tienePermiso(rol, s.roles) : false))
  const enlacesVisibles = GRUPOS.flatMap((grupo) =>
    visibles
      .filter((seccion) => seccion.grupo === grupo)
      .map((seccion) => ({ ...seccion, grupo })),
  )

  return (
    <CompactWorkspace>
      <PageHeader
        eyebrow={t('guia.eyebrow')}
        titulo={t('guia.titulo')}
        descripcion={t('guia.descripcion')}
      />

      <nav aria-label={t('guia.navegacion')} className="flex flex-wrap gap-x-2 gap-y-0 border-b border-border pb-2 text-xs">
        {(Object.keys(ANCLAS) as (keyof typeof ANCLAS)[]).map((destino) => (
          <a
            key={destino}
            href={`#${ANCLAS[destino]}`}
            className="inline-flex min-h-11 items-center rounded px-2 font-medium text-muted transition-colors hover:bg-primary-tint hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {t(`guia.nav.${destino}`)}
          </a>
        ))}
      </nav>

      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event(REOPEN_TOUR_EVENT))}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-cream-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <BookOpenText aria-hidden className="size-4 text-primary" />
        {t('guia.volverAVerRecorrido', { defaultValue: 'Volver a ver recorrido' })}
      </button>

      <section aria-labelledby="guia-inicio-titulo" className="grid scroll-mt-20 gap-4 border-b border-border pb-4 lg:grid-cols-2 lg:gap-4">
        <div className="flex flex-col justify-center">
          <p className="text-xs font-semibold tracking-wide text-primary">{t('guia.inicioEyebrow')}</p>
          <h2 id="guia-inicio-titulo" className="mt-2 font-display text-lg leading-6 font-semibold tracking-tight text-foreground">
            {t('guia.inicioTitulo')}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{t('guia.inicioDescripcion')}</p>
        </div>
        <ol className="border-t border-border pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <Paso numero={1} icono={Monitor} titulo={t('guia.pasos.monitoreo.titulo')} descripcion={t('guia.pasos.monitoreo.descripcion')} />
          <Paso numero={2} icono={Bell} titulo={t('guia.pasos.alerta.titulo')} descripcion={t('guia.pasos.alerta.descripcion')} />
          <Paso numero={3} icono={History} ultimo titulo={t('guia.pasos.historial.titulo')} descripcion={t('guia.pasos.historial.descripcion')} />
        </ol>
      </section>

      <section aria-labelledby="guia-estados-titulo" className="scroll-mt-20 space-y-2">
        <div>
          <h2 id="guia-estados-titulo" className="font-display text-lg leading-6 font-semibold tracking-tight text-foreground">
            {t('guia.estadosTitulo')}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">{t('guia.estadosDescripcion')}</p>
        </div>

        <div className="grid divide-y divide-border border-y border-border md:grid-cols-3 md:divide-x md:divide-y-0">
          <div className="flex gap-3 bg-transparent p-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#07546A] text-white"><CircleCheck aria-hidden className="size-5" /></span>
            <div>
              <h3 className="text-sm font-semibold text-[#073B4C]">{t('guia.estados.normal.titulo')}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#245365]">{t('guia.estados.normal.descripcion')}</p>
            </div>
          </div>
          <div className="flex gap-3 bg-transparent p-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#9B3156] text-white"><CircleDot aria-hidden className="size-5" /></span>
            <div>
              <h3 className="text-sm font-semibold text-[#70213D]">{t('guia.estados.preventivo.titulo')}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#7D4056]">{t('guia.estados.preventivo.descripcion')}</p>
            </div>
          </div>
          <div className="flex gap-3 bg-transparent p-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#7B2342] text-white"><CircleAlert aria-hidden className="size-5" /></span>
            <div>
              <h3 className="text-sm font-semibold text-[#641B36]">{t('guia.estados.critico.titulo')}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#74354C]">{t('guia.estados.critico.descripcion')}</p>
            </div>
          </div>
        </div>
        <p className="text-xs leading-relaxed text-muted">{t('guia.rangoNota')}</p>
      </section>

      <section aria-labelledby="guia-alerta-titulo" className="scroll-mt-20 border-l-4 border-primary bg-surface px-5 py-3 sm:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-wide text-primary">{t('guia.alertaEyebrow')}</p>
          <h2 id="guia-alerta-titulo" className="mt-2 font-display text-lg leading-6 font-semibold tracking-tight text-foreground">
            {t('guia.alertaTitulo')}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">{t('guia.alertaDescripcion')}</p>
        </div>
        <ol className="mt-5 grid gap-4 md:grid-cols-3">
          {(['revisar', 'actuar', 'registrar'] as const).map((paso, index) => (
            <li key={paso} className="border-t border-border pt-3">
              <span className="nums text-xs font-semibold text-primary">{String(index + 1).padStart(2, '0')}</span>
              <h3 className="mt-1 text-sm font-semibold text-foreground">{t(`guia.alertaPasos.${paso}.titulo`)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{t(`guia.alertaPasos.${paso}.descripcion`)}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 flex items-start gap-2 border-t border-border pt-4 text-xs leading-relaxed text-muted">
          <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
          {t('guia.alertaPermisos')}
        </p>
        <div className="mt-4 border-t border-border pt-4">
          <p className="flex items-center gap-2 text-xs font-semibold text-ink-700">
            <Info aria-hidden className="size-4 text-primary" />
            {t('guia.ejemploTitulo')}
          </p>
          <p className="mt-1.5 max-w-3xl text-xs leading-relaxed text-muted">{t('guia.ejemplo')}</p>
        </div>
      </section>

      <section aria-labelledby="guia-pantallas-titulo" className="scroll-mt-20">
        <div>
          <h2 id="guia-pantallas-titulo" className="font-display text-lg leading-6 font-semibold tracking-tight text-foreground">
            {t('guia.pantallasTitulo')}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">{t('guia.pantallasDescripcion')}</p>
        </div>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {enlacesVisibles.map((seccion) => {
            const Icono = seccion.icono
            return (
              <li key={seccion.ruta} className="min-w-0">
                <Link
                  to={seccion.ruta}
                  className="group flex h-full min-h-28 items-start gap-3 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-primary/30 hover:bg-primary-tint/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <Icono aria-hidden className="mt-0.5 size-[18px] shrink-0 text-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-primary">
                      {t(`guia.grupos.${seccion.grupo}`)}
                    </span>
                    <span className="block text-sm font-semibold text-foreground underline-offset-4 group-hover:text-primary group-hover:underline">
                      {t(seccion.tituloKey)}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted">{t(seccion.descripcionKey)}</span>
                  </span>
                  <ArrowRight aria-hidden className="mt-0.5 size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary motion-reduce:transition-none" />
                </Link>
              </li>
            )
          })}
        </ul>
      </section>

      <section aria-labelledby="guia-conceptos-titulo" className="space-y-2">
        <h2 id="guia-conceptos-titulo" className="font-display text-lg leading-6 font-semibold tracking-tight text-foreground">
          {t('guia.conceptosTitulo')}
        </h2>
        <details className="group overflow-hidden rounded-(--radius-field) border border-border bg-surface">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium outline-none hover:bg-cream-100 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
            {t('guia.conceptosAyuda')}
            <ArrowRight aria-hidden className="size-4 shrink-0 text-primary transition-transform group-open:rotate-90 motion-reduce:transition-none" />
          </summary>
          <dl className="grid gap-x-7 border-t border-border px-4 py-3 sm:grid-cols-2">
            {CONCEPTOS.map((concepto) => (
              <div key={concepto} className="border-b border-border py-3 last:border-0 sm:last:border-b">
                <dt className="text-sm font-semibold text-foreground">{t(`guia.conceptos.${concepto}.titulo`)}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-muted">{t(`guia.conceptos.${concepto}.descripcion`)}</dd>
              </div>
            ))}
          </dl>
        </details>
      </section>

      <section aria-labelledby="guia-preguntas-titulo" className="scroll-mt-20 space-y-2">
        <h2 id="guia-preguntas-titulo" className="font-display text-lg leading-6 font-semibold tracking-tight text-foreground">
          {t('guia.preguntasTitulo')}
        </h2>
        <div className="divide-y divide-border border-y border-border">
          {(['alerta', 'integridad', 'metricas'] as const).map((pregunta) => (
            <details key={pregunta} className="group py-1">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-3 text-sm font-medium text-foreground outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
                {t(`guia.preguntas.${pregunta}.titulo`)}
                <ArrowRight aria-hidden className="size-4 shrink-0 text-primary transition-transform group-open:rotate-90 motion-reduce:transition-none" />
              </summary>
              <p className="max-w-3xl pb-4 pr-7 text-sm leading-relaxed text-muted">
                {t(`guia.preguntas.${pregunta}.respuesta`)}
              </p>
            </details>
          ))}
        </div>
      </section>

      <p className="flex items-start gap-2 border-t border-border pt-4 text-xs leading-relaxed text-muted">
        <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
        {t('guia.nota')}
      </p>
    </CompactWorkspace>
  )
}
