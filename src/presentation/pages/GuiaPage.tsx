import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import {
  ArrowRight,
  Bell,
  BellRing,
  BookOpen,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  CircleDot,
  CircleHelp,
  Compass,
  FileText,
  History,
  Info,
  LayoutGrid,
  Link2,
  ListChecks,
  Monitor,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  Thermometer,
  Users,
  type LucideIcon,
} from 'lucide-react'

import { useAuthStore } from '@/application/stores/authStore'
import { tienePermiso, type Rol } from '@/domain/value-objects/Rol'
import { CompactWorkspace } from '../components/CompactWorkspace'
import { PageHeader } from '../components/PageHeader'
import { Badge } from '../components/ui/badge'
import { Detalles } from '../components/ui/detalles'
import { Panel } from '../components/ui/panel'

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

/** Índice de la guía: cada entrada apunta al título (h2) de su sección. */
const INDICE = [
  { destino: 'inicio', ancla: 'guia-inicio-titulo', icono: Compass },
  { destino: 'estados', ancla: 'guia-estados-titulo', icono: Thermometer },
  { destino: 'alertas', ancla: 'guia-alerta-titulo', icono: BellRing },
  { destino: 'pantallas', ancla: 'guia-pantallas-titulo', icono: LayoutGrid },
  { destino: 'dudas', ancla: 'guia-preguntas-titulo', icono: CircleHelp },
] as const

const ESTADOS = [
  { clave: 'normal', icono: CircleCheck, tono: 'bg-success-100 text-success-700 ring-success-600/25' },
  { clave: 'preventivo', icono: CircleDot, tono: 'bg-honey-100 text-honey-700 ring-honey-600/30' },
  { clave: 'critico', icono: CircleAlert, tono: 'bg-critical-solid text-on-critical ring-transparent' },
] as const

// Los títulos de sección son destino del índice: la cabecera fija (56 px) no
// debe taparlos al saltar.
const ANCLA_SECCION = '[&_h2]:scroll-mt-24'

export function GuiaPage() {
  const { t } = useTranslation()
  const usuario = useAuthStore((s) => s.usuario)
  const rol = usuario?.rol
  const visibles = SECCIONES.filter((s) => (rol ? tienePermiso(rol, s.roles) : false))
  const grupos = GRUPOS.map((grupo) => ({
    grupo,
    secciones: visibles.filter((seccion) => seccion.grupo === grupo),
  })).filter(({ secciones }) => secciones.length > 0)

  return (
    <CompactWorkspace>
      <PageHeader
        eyebrow={t('guia.eyebrow')}
        titulo={t('guia.titulo')}
        descripcion={t('guia.descripcion')}
      />

      <nav aria-label={t('guia.navegacion')}>
        <ul className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:flex sm:flex-wrap">
          {INDICE.map(({ destino, ancla, icono: Icono }) => (
            <li key={destino}>
              <a
                href={`#${ancla}`}
                className="inline-flex min-h-11 w-full items-center gap-2 rounded-full border border-border bg-surface px-3.5 text-[13px] font-medium text-muted transition-colors duration-(--duration-micro) hover:border-border-strong hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:min-h-9 sm:w-auto sm:pointer-coarse:min-h-11"
              >
                <Icono aria-hidden className="size-4 shrink-0 text-primary" />
                {t(`guia.nav.${destino}`)}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* ── 1. Rutina de la jornada ─────────────────────────── */}
      <Panel
        id="guia-inicio"
        icono={Compass}
        titulo={t('guia.inicioTitulo')}
        descripcion={t('guia.inicioDescripcion')}
        acciones={<Badge variant="outline">{t('guia.inicioEyebrow')}</Badge>}
        className={ANCLA_SECCION}
      >
        <ol className="grid gap-5 md:grid-cols-3 md:gap-6">
          {(
            [
              ['monitoreo', Monitor],
              ['alerta', Bell],
              ['historial', History],
            ] as const
          ).map(([paso, Icono], index) => (
            <li key={paso} className="flex gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface-sunken text-primary">
                <Icono aria-hidden className="size-4" />
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-sm font-semibold text-foreground">
                  <span className="nums mr-1.5 text-muted">{index + 1}.</span>
                  {t(`guia.pasos.${paso}.titulo`)}
                </p>
                <p className="mt-1 text-[13px] leading-5 text-muted">{t(`guia.pasos.${paso}.descripcion`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </Panel>

      {/* ── 2. Estados de la temperatura ────────────────────── */}
      <Panel
        id="guia-estados"
        icono={Thermometer}
        titulo={t('guia.estadosTitulo')}
        descripcion={t('guia.estadosDescripcion')}
        className={ANCLA_SECCION}
      >
        <ul className="grid gap-5 md:grid-cols-3 md:gap-6">
          {ESTADOS.map(({ clave, icono: Icono, tono }) => (
            <li key={clave} className="flex gap-3">
              <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${tono}`}>
                <Icono aria-hidden className="size-5" />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-foreground">{t(`guia.estados.${clave}.titulo`)}</h3>
                <p className="mt-1 text-[13px] leading-5 text-muted">{t(`guia.estados.${clave}.descripcion`)}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-5 border-t border-border pt-3 text-xs leading-5 text-muted">{t('guia.rangoNota')}</p>
      </Panel>

      {/* ── 3. Ante un aviso ────────────────────────────────── */}
      <Panel
        id="guia-alerta"
        icono={BellRing}
        titulo={t('guia.alertaTitulo')}
        descripcion={t('guia.alertaDescripcion')}
        acciones={<Badge variant="outline">{t('guia.alertaEyebrow')}</Badge>}
        className={ANCLA_SECCION}
      >
        <ol className="grid gap-5 md:grid-cols-3 md:gap-6">
          {(['revisar', 'actuar', 'registrar'] as const).map((paso, index) => (
            <li key={paso} className="flex gap-3">
              <span className="nums flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-tint text-xs font-semibold text-primary ring-1 ring-inset ring-primary/15">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0 pt-0.5">
                <h3 className="text-sm font-semibold text-foreground">{t(`guia.alertaPasos.${paso}.titulo`)}</h3>
                <p className="mt-1 text-[13px] leading-5 text-muted">{t(`guia.alertaPasos.${paso}.descripcion`)}</p>
              </div>
            </li>
          ))}
        </ol>
        {/* Permisos por rol y el ejemplo: a un clic, sin cargar la sección. */}
        <Detalles className="mt-4 border-t border-border pt-2">
          <div className="space-y-4 pb-1">
            <p className="flex max-w-[72ch] items-start gap-2 text-[13px] leading-5 text-muted">
              <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
              {t('guia.alertaPermisos')}
            </p>
            <div className="max-w-[72ch]">
              <p className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
                <Info aria-hidden className="size-4 shrink-0 text-primary" />
                {t('guia.ejemploTitulo')}
              </p>
              <p className="mt-1 pl-6 text-[13px] leading-5 text-muted">{t('guia.ejemplo')}</p>
            </div>
          </div>
        </Detalles>
      </Panel>

      {/* ── 4. Pantallas disponibles para el rol ────────────── */}
      <Panel
        id="guia-pantallas"
        icono={LayoutGrid}
        titulo={t('guia.pantallasTitulo')}
        descripcion={t('guia.pantallasDescripcion')}
        className={ANCLA_SECCION}
      >
        <div className="space-y-5">
          {grupos.map(({ grupo, secciones }) => (
            <div key={grupo}>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-faint">{t(`guia.grupos.${grupo}`)}</h3>
              <ul className="mt-2 grid gap-1 sm:grid-cols-2 xl:grid-cols-3">
                {secciones.map((seccion) => {
                  const Icono = seccion.icono
                  return (
                    <li key={seccion.ruta} className="min-w-0">
                      <Link
                        to={seccion.ruta}
                        className="group -mx-1 flex h-full items-start gap-3 rounded-lg p-3 transition-colors duration-(--duration-micro) hover:bg-cream-200/45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        <Icono aria-hidden className="mt-0.5 size-[18px] shrink-0 text-primary" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-foreground underline-offset-4 group-hover:underline">
                            {t(seccion.tituloKey)}
                          </span>
                          <span className="mt-0.5 block text-[13px] leading-5 text-muted">{t(seccion.descripcionKey)}</span>
                        </span>
                        <ArrowRight
                          aria-hidden
                          className="mt-0.5 size-4 shrink-0 text-faint transition-transform duration-(--duration-ui) group-hover:translate-x-0.5 group-hover:text-foreground motion-reduce:transition-none"
                        />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      </Panel>

      {/* ── 5. Palabras útiles y dudas frecuentes ───────────── */}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Panel id="guia-conceptos" icono={BookOpen} titulo={t('guia.conceptosTitulo')} className={ANCLA_SECCION}>
          <Detalles titulo={t('guia.conceptosAyuda')}>
            <dl className="divide-y divide-border">
              {CONCEPTOS.map((concepto) => (
                <div key={concepto} className="py-3 first:pt-1 last:pb-1">
                  <dt className="text-sm font-semibold text-foreground">{t(`guia.conceptos.${concepto}.titulo`)}</dt>
                  <dd className="mt-1 text-[13px] leading-5 text-muted">{t(`guia.conceptos.${concepto}.descripcion`)}</dd>
                </div>
              ))}
            </dl>
          </Detalles>
        </Panel>

        <Panel
          id="guia-preguntas"
          icono={CircleHelp}
          titulo={t('guia.preguntasTitulo')}
          className={ANCLA_SECCION}
          cuerpoClassName="px-4 py-1 sm:px-5 sm:py-1"
        >
          <div className="divide-y divide-border">
            {(['alerta', 'integridad', 'metricas'] as const).map((pregunta) => (
              <details key={pregunta} className="group">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-3 text-sm font-medium text-foreground outline-none transition-colors duration-(--duration-micro) hover:text-primary focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                  {t(`guia.preguntas.${pregunta}.titulo`)}
                  <ChevronDown
                    aria-hidden
                    className="size-4 shrink-0 text-muted transition-transform duration-(--duration-ui) group-open:rotate-180 motion-reduce:transition-none"
                  />
                </summary>
                <p className="max-w-[72ch] pb-4 pr-7 text-[13px] leading-5 text-muted">
                  {t(`guia.preguntas.${pregunta}.respuesta`)}
                </p>
              </details>
            ))}
          </div>
        </Panel>
      </div>

      <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
        <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
        {t('guia.nota')}
      </p>
    </CompactWorkspace>
  )
}
