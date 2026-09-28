import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import {
  BookOpen,
  Activity,
  Bell,
  Brain,
  ClipboardCheck,
  DownloadCloud,
  FileText,
  FlaskConical,
  HardDrive,
  History,
  Link2,
  LogOut,
  Menu,
  ScrollText,
  Users,
  X,
} from 'lucide-react'

import { useAuthStore } from '@/application/stores/authStore'
import { tienePermiso, type Rol } from '@/domain/value-objects/Rol'
import { MODO_DEMO } from '@/infrastructure/demo/modoDemo'
import { cn } from '@/lib/utils'
import { AvisoExpiracionSesion } from '../components/AvisoExpiracionSesion'
import { ColdCareBrand } from '../components/ColdCareBrand'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { OnboardingTour } from '../components/OnboardingTour'

interface ItemNav {
  ruta: string
  icono: React.ComponentType<{ className?: string }>
  claveI18n: string
  roles: Rol[]
}

interface SeccionNav {
  claveI18n: string
  items: ItemNav[]
}

const SECCIONES: SeccionNav[] = [
  {
    claveI18n: 'nav.seccionOperacion',
    items: [
      // La guía va primero y la ve todo el mundo: es el punto de entrada para
      // quien abre el sistema por primera vez.
      //
      // HU-41: AUDITOR entra aquí explícitamente en dashboard/historial/
      // alertas/trazabilidad — el backend le da lectura sobre los mismos
      // endpoints (lecturas_router, alertas_router, trazabilidad_router).
      { ruta: '/guia', icono: BookOpen, claveI18n: 'nav.guia', roles: ['farmaceutico', 'tecnico', 'auditor'] },
      { ruta: '/dashboard', icono: Activity, claveI18n: 'nav.dashboard', roles: ['farmaceutico', 'tecnico', 'auditor'] },
      { ruta: '/historial', icono: History, claveI18n: 'nav.historial', roles: ['farmaceutico', 'tecnico', 'auditor'] },
      { ruta: '/alertas', icono: Bell, claveI18n: 'nav.alertas', roles: ['farmaceutico', 'tecnico', 'auditor'] },
    ],
  },
  {
    claveI18n: 'nav.seccionCumplimiento',
    items: [
      { ruta: '/trazabilidad', icono: Link2, claveI18n: 'nav.trazabilidad', roles: ['farmaceutico', 'tecnico', 'auditor'] },
      // El checklist BPA NO está en la matriz de AUDITOR del backend
      // (checklist_router.py solo admite FARMACEUTICO/ADMINISTRADOR).
      { ruta: '/checklist-bpa', icono: ClipboardCheck, claveI18n: 'nav.checklist', roles: ['farmaceutico'] },
      { ruta: '/reportes', icono: FileText, claveI18n: 'nav.reportes', roles: ['farmaceutico', 'auditor'] },
      { ruta: '/metricas-ia', icono: Brain, claveI18n: 'nav.metricasIA', roles: ['farmaceutico', 'auditor'] },
    ],
  },
  {
    claveI18n: 'nav.seccionAdministracion',
    items: [
      // HU-41: auditoria sí es de AUDITOR (require_roles(ADMINISTRADOR,
      // AUDITOR) en auditoria_router.py) — el resto de esta sección sigue
      // siendo exclusiva del administrador.
      { ruta: '/auditoria', icono: ScrollText, claveI18n: 'nav.auditoria', roles: ['auditor'] },
      { ruta: '/usuarios', icono: Users, claveI18n: 'nav.usuarios', roles: [] },
      { ruta: '/dispositivos', icono: HardDrive, claveI18n: 'nav.dispositivos', roles: [] },
      { ruta: '/firmware', icono: DownloadCloud, claveI18n: 'nav.firmware', roles: [] },
    ],
  },
]

function MarcaApp() {
  const { t } = useTranslation()
  return <ColdCareBrand subtitulo={t('app.subtitulo')} />
}

function BadgeDemo({ className }: { className?: string }) {
  const { t } = useTranslation()
  if (!MODO_DEMO) return null
  return (
    <span
      title={t('demo.descripcionBadge')}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-glacier-200 bg-secondary-tint px-2.5 py-1 text-xs font-semibold text-glacier-700',
        className,
      )}
    >
      <FlaskConical className="size-3" />
      {t('demo.badge')}
    </span>
  )
}

/**
 * Contenido del sidebar, compartido entre escritorio y el drawer móvil.
 *
 * `sufijoId` distingue las dos instancias: con el drawer abierto hay dos `nav`
 * en el documento y dos juegos de encabezados de sección. Sin nombres
 * distintos, la lista de regiones del lector de pantalla mostraba dos entradas
 * idénticas y los `id` de `aria-labelledby` quedaban duplicados.
 */
function ContenidoSidebar({
  alNavegar,
  etiquetaNav,
  sufijoId,
}: {
  alNavegar?: () => void
  etiquetaNav: string
  sufijoId: string
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const usuario = useAuthStore((s) => s.usuario)
  const logout = useAuthStore((s) => s.logout)

  if (!usuario) return null

  const cerrarSesion = () => {
    logout()
    void navigate('/login', { replace: true })
  }

  return (
    <>
      <nav aria-label={etiquetaNav} className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {SECCIONES.map((seccion) => {
          const visibles = seccion.items.filter((item) => tienePermiso(usuario.rol, item.roles))
          if (visibles.length === 0) return null
          const idTitulo = `${sufijoId}-${seccion.claveI18n.replace(/\./g, '-')}`
          return (
            <div key={seccion.claveI18n}>
              <p id={idTitulo} className="eyebrow mb-1.5 flex items-center gap-2 px-2">
                {t(seccion.claveI18n)}
                <span className="h-px flex-1 bg-border/80" aria-hidden />
              </p>
              <ul aria-labelledby={idTitulo} className="space-y-0.5">
                {visibles.map((item) => (
                  <li key={item.ruta}>
                    <NavLink
                      to={item.ruta}
                      data-tour-route={item.ruta}
                      onClick={alNavegar}
                      className={({ isActive }) =>
                        cn(
                          'group relative flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition-[color,background-color,transform] duration-150',
                          isActive
                            ? 'bg-primary-tint text-pine-700 shadow-[inset_0_0_0_1px_rgb(11_92_255_/_0.12)]'
                            : 'text-muted hover:translate-x-0.5 hover:bg-cream-200/70 hover:text-foreground',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {/* Barra de tinta que marca la sección activa */}
                          <span
                            aria-hidden
                            className={cn(
                              'absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary transition-opacity duration-150',
                              isActive ? 'opacity-100' : 'opacity-0',
                            )}
                          />
                          <item.icono
                            className={cn(
                              'size-4 transition-colors',
                              isActive ? 'text-pine-600' : 'text-faint group-hover:text-muted',
                            )}
                          />
                          {t(item.claveI18n)}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </nav>

      <div className="border-t border-border px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mb-3 flex items-center gap-2.5 rounded-lg border border-border/80 bg-surface px-2.5 py-2 shadow-(--shadow-card)">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-pine-200 font-display text-sm font-semibold text-pine-700 ring-2 ring-pine-100">
            {usuario.email.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[13px] font-medium text-foreground">{usuario.email}</p>
            <p className="text-[11px] text-pine-600">{t(`roles.${usuario.rol}`)}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={cerrarSesion}
          className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium text-muted transition-colors duration-150 hover:bg-clay-100 hover:text-clay-700"
        >
          <LogOut className="size-4" />
          {t('nav.cerrarSesion')}
        </button>
      </div>
    </>
  )
}

export function AppLayout() {
  const { t, i18n } = useTranslation()
  const usuario = useAuthStore((s) => s.usuario)
  const [drawerAbierto, setDrawerAbierto] = useState(false)

  if (!usuario) return null

  const fechaHoy = new Date().toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="flex min-h-dvh">
      {/* WCAG 2.4.1 (Evitar bloques): la navegación son doce enlaces repetidos
          en cada página. Sin este atajo, llegar al contenido con el teclado
          exigía atravesarlos uno a uno en todas las rutas. Se mantiene oculto
          hasta recibir el foco. */}
      <a
        href="#contenido-principal"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-(--radius-field) focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-cream-50 focus:shadow-(--shadow-raised)"
      >
        {t('nav.saltarAlContenido')}
      </a>

      {/* ── Sidebar de escritorio ────────────────────────────── */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-gradient-to-b from-cream-100/90 to-cream-100/50 lg:flex">
        <div className="px-5 pb-5 pt-6">
          <MarcaApp />
        </div>
        <ContenidoSidebar etiquetaNav={t('nav.principal')} sufijoId="nav-escritorio" />
      </aside>

      {/* ── Drawer móvil ─────────────────────────────────────── */}
      <DialogPrimitive.Root open={drawerAbierto} onOpenChange={setDrawerAbierto}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-[2px] data-[state=open]:animate-fade lg:hidden" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-border bg-background shadow-(--shadow-raised) data-[state=open]:animate-(--animate-drawer) lg:hidden"
          >
            <DialogPrimitive.Title className="sr-only">{t('app.nombre')}</DialogPrimitive.Title>
            <div className="flex items-center justify-between px-5 pb-5 pt-6">
              <MarcaApp />
              <DialogPrimitive.Close
                aria-label={t('comunes.cerrar')}
                className="flex size-11 items-center justify-center rounded-md text-muted transition-colors hover:bg-cream-200 hover:text-foreground"
              >
                <X className="size-4.5" />
              </DialogPrimitive.Close>
            </div>
            <ContenidoSidebar
              alNavegar={() => setDrawerAbierto(false)}
              etiquetaNav={t('nav.principalMovil')}
              sufijoId="nav-movil"
            />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>

        {/* ── Contenido ──────────────────────────────────────── */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* FS5: por encima de la cabecera, para que se vea en cualquier ruta. */}
          <AvisoExpiracionSesion />
          <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-sm sm:px-6">
            <DialogPrimitive.Trigger
              aria-label={t('nav.abrirMenu')}
              data-tour-mobile-menu
              className="-ml-1 flex size-11 items-center justify-center rounded-md text-muted transition-colors hover:bg-cream-200 hover:text-foreground lg:hidden"
            >
              <Menu className="size-5" />
            </DialogPrimitive.Trigger>

            <ColdCareBrand className="lg:hidden" />

            <p className="hidden font-display text-[13px] italic text-faint first-letter:uppercase lg:block">
              {fechaHoy}
            </p>

            <div className="ml-auto flex items-center gap-2.5">
              <BadgeDemo className="hidden sm:inline-flex" />
              <LanguageSwitcher />
            </div>
          </header>

          <main
            id="contenido-principal"
            tabIndex={-1}
            aria-label={t('nav.contenidoPrincipal')}
            className="min-w-0 flex-1 overflow-x-clip px-4 py-5 focus:outline-none sm:px-6 sm:py-6 lg:px-8"
          >
            {/* Tope de ancho: en monitores muy anchos el contenido no se estira sin fin */}
            <div className="mx-auto w-full max-w-[1400px]">
              <Outlet />
            </div>
          </main>
        </div>
      </DialogPrimitive.Root>
      <OnboardingTour rol={usuario.rol} userId={usuario.id} />
    </div>
  )
}
