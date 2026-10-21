import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import {
  BookOpen,
  Activity,
  Bell,
  Brain,
  FileText,
  FlaskConical,
  HardDrive,
  History,
  Link2,
  KeyRound,
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
      // El tablero va primero: responde de inmediato cómo está el refrigerador.
      // HU-41: AUDITOR entra aquí explícitamente en dashboard/historial/
      // alertas/trazabilidad — el backend le da lectura sobre los mismos
      // endpoints (lecturas_router, alertas_router, trazabilidad_router).
      { ruta: '/dashboard', icono: Activity, claveI18n: 'nav.dashboard', roles: ['farmaceutico', 'tecnico', 'auditor'] },
      { ruta: '/alertas', icono: Bell, claveI18n: 'nav.alertas', roles: ['farmaceutico', 'tecnico', 'auditor'] },
      { ruta: '/historial', icono: History, claveI18n: 'nav.historial', roles: ['farmaceutico', 'tecnico', 'auditor'] },
      { ruta: '/guia', icono: BookOpen, claveI18n: 'nav.guia', roles: ['farmaceutico', 'tecnico', 'auditor'] },
    ],
  },
  {
    claveI18n: 'nav.seccionCumplimiento',
    items: [
      { ruta: '/trazabilidad', icono: Link2, claveI18n: 'nav.trazabilidad', roles: ['farmaceutico', 'tecnico', 'auditor'] },
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
    ],
  },
]

function MarcaApp() {
  const { t } = useTranslation()
  return <ColdCareBrand tone="dark" subtitulo={t('app.subtitulo')} />
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
 * FE-002: aviso persistente en TODAS las pantallas y tamaños (la insignia de
 * la cabecera se oculta en móvil). En un sistema de cadena de frío, confundir
 * datos simulados con reales puede ocultar una excursión térmica verdadera.
 */
function AvisoDatosSimulados() {
  const { t } = useTranslation()
  if (!MODO_DEMO) return null
  return (
    <div
      role="status"
      className="flex items-center gap-2 border-b border-amber-300 bg-amber-50 px-4 py-1.5 text-xs text-amber-900 sm:px-6 lg:px-7"
    >
      <FlaskConical aria-hidden className="size-3.5 shrink-0" />
      <p>
        <strong className="font-semibold">{t('demo.avisoTitulo')}.</strong> {t('demo.avisoDetalle')}
      </p>
    </div>
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
      <nav aria-label={etiquetaNav} className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 pb-4 lg:space-y-3 lg:pb-2 [@media(max-height:760px)]:space-y-2">
        {SECCIONES.map((seccion) => {
          const visibles = seccion.items.filter((item) => tienePermiso(usuario.rol, item.roles))
          if (visibles.length === 0) return null
          const idTitulo = `${sufijoId}-${seccion.claveI18n.replace(/\./g, '-')}`
          return (
            <div key={seccion.claveI18n}>
              <p id={idTitulo} className="mb-2 px-3 text-[11px] lg:mb-1 font-semibold uppercase leading-5 tracking-[0.12em] text-faint">
                {t(seccion.claveI18n)}
              </p>
              <ul aria-labelledby={idTitulo} className="space-y-1 lg:space-y-0.5">
                {visibles.map((item) => (
                  <li key={item.ruta}>
                    <NavLink
                      to={item.ruta}
                      onClick={alNavegar}
                      className={({ isActive }) =>
                        cn(
                          'group flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 lg:min-h-9 lg:py-1.5 [@media(max-height:760px)]:min-h-8 [@media(max-height:760px)]:py-1 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                          isActive
                            ? 'bg-primary-tint text-primary'
                            : 'text-muted hover:bg-background hover:text-foreground',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <item.icono
                            className={cn(
                              'size-4 transition-colors',
                              isActive ? 'text-primary' : 'text-faint group-hover:text-foreground',
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

      <div className="border-t border-border px-3 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] lg:pt-2 lg:pb-3 [@media(max-height:760px)]:pt-1 [@media(max-height:760px)]:pb-2">
        <div className="mb-3 flex items-center gap-3 px-3 py-1 lg:mb-1 lg:py-0.5 [@media(max-height:760px)]:mb-0">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full lg:size-8 bg-primary-tint text-sm font-semibold text-primary">
            {usuario.email.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[13px] font-medium text-foreground">{usuario.email}</p>
            <p className="mt-1 text-xs leading-4 text-faint">{t(`roles.${usuario.rol}`)}</p>
          </div>
          {/* FE-004: cambio de contraseña voluntario (BE-025). */}
          <NavLink
            to="/cambiar-password"
            onClick={alNavegar}
            aria-label={t('cambiarPassword.menu')}
            title={t('cambiarPassword.menu')}
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <KeyRound className="size-4" />
          </NavLink>
        </div>
        <button
          type="button"
          onClick={cerrarSesion}
          className="flex min-h-11 lg:min-h-9 [@media(max-height:760px)]:min-h-8 w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors duration-150 hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
  const { pathname } = useLocation()
  const rutaActual = SECCIONES.flatMap((seccion) => seccion.items).find((item) =>
    pathname === item.ruta || pathname.startsWith(`${item.ruta}/`),
  )

  if (!usuario) return null

  const fechaHoy = new Date().toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="flex min-h-dvh bg-[#F4F7FB]">
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
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-white lg:flex">
        <div className="px-5 pb-7 pt-6 lg:pb-4 lg:pt-5 [@media(max-height:760px)]:pb-2 [@media(max-height:760px)]:pt-3">
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
            className="fixed inset-y-0 left-0 z-50 flex w-80 max-w-[90vw] flex-col bg-white shadow-(--shadow-raised) data-[state=open]:animate-(--animate-drawer) lg:hidden"
          >
            <DialogPrimitive.Title className="sr-only">{t('app.nombre')}</DialogPrimitive.Title>
            <div className="flex items-center justify-between gap-3 px-5 pb-6 pt-5 [@media(max-height:760px)]:pb-2 [@media(max-height:760px)]:pt-2">
              <MarcaApp />
              <DialogPrimitive.Close
                aria-label={t('comunes.cerrar')}
                className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
          <AvisoDatosSimulados />
          <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-[#E2E8F0] bg-white px-4 sm:px-6 lg:px-7">
            <DialogPrimitive.Trigger
              aria-label={t('nav.abrirMenu')}
              className="-ml-1 flex size-11 shrink-0 items-center justify-center rounded-lg text-[#475569] transition-colors hover:bg-[#F4F7FB] hover:text-[#0F172A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B5CFF] lg:hidden"
            >
              <Menu className="size-5" />
            </DialogPrimitive.Trigger>

            <ColdCareBrand className="lg:hidden" />

            <div className="hidden min-w-0 items-center gap-5 lg:flex">
              <p className="truncate text-sm font-semibold text-[#0F172A]">
                {rutaActual ? t(rutaActual.claveI18n) : t('app.nombre')}
              </p>
              <p className="text-xs text-[#64748B] first-letter:uppercase">
                {fechaHoy}
              </p>
            </div>

            <div className="ml-auto flex items-center gap-2.5">
              <BadgeDemo className="hidden sm:inline-flex" />
              <LanguageSwitcher />
            </div>
          </header>

          <main
            id="contenido-principal"
            tabIndex={-1}
            aria-label={t('nav.contenidoPrincipal')}
            className="min-w-0 flex-1 overflow-x-clip bg-[#F4F7FB] px-4 py-5 focus:outline-none sm:px-6 sm:py-6 lg:px-7"
          >
            {/* Tope de ancho: en monitores muy anchos el contenido no se estira sin fin */}
            <div className="mx-auto w-full max-w-[1600px]">
              <Outlet />
            </div>
          </main>
        </div>
      </DialogPrimitive.Root>
    </div>
  )
}
