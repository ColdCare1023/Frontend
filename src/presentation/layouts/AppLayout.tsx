import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { motion, useReducedMotion } from 'motion/react'
import {
  BookOpen,
  Activity,
  Bell,
  Brain,
  ChevronDown,
  ChevronRight,
  FileText,
  FlaskConical,
  HardDrive,
  History,
  Link2,
  KeyRound,
  LogOut,
  Menu as MenuIcono,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  Users,
  X,
} from 'lucide-react'

import { useAuthStore } from '@/application/stores/authStore'
import { tienePermiso, type Rol } from '@/domain/value-objects/Rol'
import { MODO_DEMO } from '@/infrastructure/demo/modoDemo'
import { AvisosTiempoReal } from '@/presentation/components/AvisosTiempoReal'
import { cn } from '@/lib/utils'
import { AvisoExpiracionSesion } from '../components/AvisoExpiracionSesion'
import { ColdCareBrand } from '../components/ColdCareBrand'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { ThemeSwitcher } from '../components/ThemeSwitcher'
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '../components/ui/menu'
import { Tooltip, TooltipProvider } from '../components/ui/tooltip'
import { ANCHO_COLAPSADO, ANCHO_EXPANDIDO, guardarColapsado, leerColapsado } from './preferenciaSidebar'

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

const RESORTE = { type: 'spring', stiffness: 380, damping: 35, mass: 0.75 } as const
const ENTRADA_PAGINA = { duration: 0.24, ease: [0.16, 1, 0.3, 1] } as const

function BadgeDemo({ className }: { className?: string }) {
  const { t } = useTranslation()
  if (!MODO_DEMO) return null
  return (
    <span
      title={t('demo.descripcionBadge')}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-secondary-tint px-2.5 py-1 text-xs font-semibold text-glacier-700 ring-1 ring-inset ring-glacier-200',
        className,
      )}
    >
      <FlaskConical className="size-3" aria-hidden />
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
      className="flex items-center gap-2 border-b border-honey-600/20 bg-honey-100 px-4 py-1.5 text-xs leading-5 text-honey-700 sm:px-6 lg:px-8"
    >
      <FlaskConical aria-hidden className="size-3.5 shrink-0" />
      <p>
        <strong className="font-semibold">{t('demo.avisoTitulo')}.</strong> {t('demo.avisoDetalle')}
      </p>
    </div>
  )
}

/**
 * Navegación compartida entre el riel de escritorio y el drawer móvil.
 *
 * `sufijoId` distingue las dos instancias: con el drawer abierto hay dos `nav`
 * en el documento y dos juegos de encabezados de sección. Sin nombres
 * distintos, la lista de regiones del lector de pantalla mostraba dos entradas
 * idénticas y los `id` de `aria-labelledby` quedaban duplicados.
 */
function NavegacionPrincipal({
  alNavegar,
  etiquetaNav,
  sufijoId,
  colapsado = false,
}: {
  alNavegar?: () => void
  etiquetaNav: string
  sufijoId: string
  colapsado?: boolean
}) {
  const { t } = useTranslation()
  const reducir = useReducedMotion()
  const usuario = useAuthStore((s) => s.usuario)
  if (!usuario) return null

  return (
    <nav aria-label={etiquetaNav} className="min-h-0 flex-1 space-y-5 overflow-y-auto overflow-x-hidden px-3 py-2 [@media(max-height:760px)]:space-y-3">
      {SECCIONES.map((seccion) => {
        const visibles = seccion.items.filter((item) => tienePermiso(usuario.rol, item.roles))
        if (visibles.length === 0) return null
        const idTitulo = `${sufijoId}-${seccion.claveI18n.replace(/\./g, '-')}`
        return (
          <div key={seccion.claveI18n}>
            <div className="relative mb-1.5 h-5">
              <p
                id={idTitulo}
                className={cn(
                  'truncate px-[15px] text-[11px] leading-5 font-semibold uppercase tracking-[0.12em] text-faint transition-opacity duration-(--duration-ui)',
                  colapsado && 'opacity-0',
                )}
              >
                {t(seccion.claveI18n)}
              </p>
              <span
                aria-hidden
                className={cn(
                  'absolute left-1/2 top-1/2 h-px w-6 -translate-x-1/2 bg-border-strong transition-opacity duration-(--duration-ui)',
                  colapsado ? 'opacity-100' : 'opacity-0',
                )}
              />
            </div>
            <ul aria-labelledby={idTitulo} className="space-y-0.5">
              {visibles.map((item) => (
                <li key={item.ruta}>
                  <Tooltip contenido={t(item.claveI18n)} desactivado={!colapsado}>
                    <NavLink
                      to={item.ruta}
                      onClick={alNavegar}
                      className={({ isActive }) =>
                        cn(
                          'group relative flex h-11 items-center gap-3 rounded-lg px-[15px] text-[13.5px] font-medium whitespace-nowrap outline-none transition-colors duration-(--duration-micro) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:h-9 lg:pointer-coarse:h-11 lg:[@media(max-height:700px)]:h-8',
                          isActive ? 'text-foreground' : 'text-muted hover:bg-cream-200/60 hover:text-foreground',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && (
                            <motion.span
                              layoutId={`nav-activo-${sufijoId}`}
                              transition={reducir ? { duration: 0 } : RESORTE}
                              aria-hidden
                              className="absolute inset-0 rounded-lg bg-primary-tint ring-1 ring-inset ring-primary/15"
                            >
                              <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
                            </motion.span>
                          )}
                          <item.icono
                            className={cn(
                              'relative size-[18px] shrink-0 transition-colors duration-(--duration-micro)',
                              isActive ? 'text-primary' : 'text-faint group-hover:text-foreground',
                            )}
                          />
                          <span
                            className={cn(
                              'relative truncate transition-opacity duration-(--duration-ui)',
                              colapsado && 'opacity-0',
                            )}
                          >
                            {t(item.claveI18n)}
                          </span>
                        </>
                      )}
                    </NavLink>
                  </Tooltip>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </nav>
  )
}

/** Cuenta del usuario: datos, cambio de contraseña (FE-004) y cierre de sesión. */
function MenuUsuario() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const usuario = useAuthStore((s) => s.usuario)
  const logout = useAuthStore((s) => s.logout)
  if (!usuario) return null
  const inicial = usuario.email.charAt(0).toUpperCase()

  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label={`${t('nav.menuUsuario')}: ${usuario.email}`}
          className="flex h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-lg pl-1 pr-1.5 text-muted transition-colors duration-(--duration-micro) hover:bg-cream-200/70 hover:text-foreground data-[state=open]:bg-cream-200/70 sm:h-9 sm:pointer-coarse:h-11"
        >
          <span className="flex size-7 items-center justify-center rounded-full bg-primary-tint text-xs font-semibold text-primary ring-1 ring-inset ring-primary/20">
            {inicial}
          </span>
          <span className="hidden max-w-40 truncate text-[13px] font-medium text-foreground xl:block">{usuario.email}</span>
          <ChevronDown className="size-3.5 max-[399px]:hidden" aria-hidden />
        </button>
      </MenuTrigger>
      <MenuContent className="w-64">
        <div className="flex items-center gap-3 px-2.5 py-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-tint text-sm font-semibold text-primary ring-1 ring-inset ring-primary/20">
            {inicial}
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[13px] font-medium text-foreground">{usuario.email}</p>
            <p className="mt-1 text-xs text-faint">{t(`roles.${usuario.rol}`)}</p>
          </div>
        </div>
        <MenuSeparator />
        <MenuItem onSelect={() => void navigate('/cambiar-password')}>
          <KeyRound className="text-faint" aria-hidden />
          {t('cambiarPassword.menu')}
        </MenuItem>
        <MenuItem
          onSelect={() => {
            logout()
            void navigate('/login', { replace: true })
          }}
        >
          <LogOut className="text-faint" aria-hidden />
          {t('nav.cerrarSesion')}
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}

export function AppLayout() {
  const { t, i18n } = useTranslation()
  const reducir = useReducedMotion()
  const usuario = useAuthStore((s) => s.usuario)
  const [drawerAbierto, setDrawerAbierto] = useState(false)
  const [colapsado, setColapsado] = useState(leerColapsado)
  const { pathname } = useLocation()
  const seccionActual = SECCIONES.find((seccion) =>
    seccion.items.some((item) => pathname === item.ruta || pathname.startsWith(`${item.ruta}/`)),
  )
  const rutaActual = seccionActual?.items.find((item) =>
    pathname === item.ruta || pathname.startsWith(`${item.ruta}/`),
  )

  if (!usuario) return null

  const alternarColapso = () => {
    setColapsado((previo) => {
      guardarColapsado(!previo)
      return !previo
    })
  }

  const fechaHoy = new Date().toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  const etiquetaColapso = colapsado ? t('nav.expandirMenu') : t('nav.colapsarMenu')

  return (
    <TooltipProvider delayDuration={250} skipDelayDuration={150}>
      <div className="flex min-h-dvh">
        {/* WCAG 2.4.1 (Evitar bloques): la navegación son doce enlaces repetidos
            en cada página. Sin este atajo, llegar al contenido con el teclado
            exigía atravesarlos uno a uno en todas las rutas. Se mantiene oculto
            hasta recibir el foco. */}
        <a
          href="#contenido-principal"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-(--radius-field) focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-on-primary focus:shadow-(--shadow-raised)"
        >
          {t('nav.saltarAlContenido')}
        </a>

        {/* ── Riel de escritorio: colapsable, con preferencia recordada ── */}
        <motion.aside
          initial={false}
          animate={{ width: colapsado ? ANCHO_COLAPSADO : ANCHO_EXPANDIDO }}
          transition={reducir ? { duration: 0 } : RESORTE}
          data-state={colapsado ? 'colapsado' : 'expandido'}
          className="sticky top-0 hidden h-dvh shrink-0 flex-col overflow-hidden border-r border-border bg-surface lg:flex"
        >
          <div className="flex h-14 shrink-0 items-center px-4">
            <ColdCareBrand
              subtitulo={t('app.subtitulo')}
              className={cn('[&_p]:transition-opacity [&_p]:duration-(--duration-ui) [&_svg]:size-9', colapsado && '[&_p]:opacity-0')}
            />
          </div>
          <NavegacionPrincipal etiquetaNav={t('nav.principal')} sufijoId="nav-escritorio" colapsado={colapsado} />
          <div className="shrink-0 border-t border-border p-3">
            <Tooltip contenido={etiquetaColapso} desactivado={!colapsado}>
              <button
                type="button"
                onClick={alternarColapso}
                aria-expanded={!colapsado}
                aria-label={etiquetaColapso}
                className="flex h-9 w-full cursor-pointer items-center gap-3 rounded-lg px-[15px] text-[13px] font-medium whitespace-nowrap text-muted transition-colors duration-(--duration-micro) hover:bg-cream-200/60 hover:text-foreground"
              >
                {colapsado ? <PanelLeftOpen className="size-[18px] shrink-0" aria-hidden /> : <PanelLeftClose className="size-[18px] shrink-0" aria-hidden />}
                <span className={cn('transition-opacity duration-(--duration-ui)', colapsado && 'opacity-0')} aria-hidden>
                  {t('nav.colapsarMenu')}
                </span>
              </button>
            </Tooltip>
          </div>
        </motion.aside>

        {/* ── Drawer móvil ─────────────────────────────────────── */}
        <DialogPrimitive.Root open={drawerAbierto} onOpenChange={setDrawerAbierto}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-overlay/55 backdrop-blur-[2px] data-[state=open]:animate-fade data-[state=closed]:animate-fade-out lg:hidden" />
            <DialogPrimitive.Content
              aria-describedby={undefined}
              className="fixed inset-y-0 left-0 z-50 flex w-[288px] max-w-[86vw] flex-col border-r border-border bg-surface shadow-(--shadow-raised) data-[state=open]:animate-(--animate-drawer) data-[state=closed]:animate-(--animate-drawer-out) focus:outline-none lg:hidden"
            >
              <DialogPrimitive.Title className="sr-only">{t('app.nombre')}</DialogPrimitive.Title>
              <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border pl-4 pr-2">
                <ColdCareBrand subtitulo={t('app.subtitulo')} className="[&_svg]:size-9" />
                <DialogPrimitive.Close
                  aria-label={t('comunes.cerrar')}
                  className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors hover:bg-cream-200/70 hover:text-foreground"
                >
                  <X className="size-4.5" aria-hidden />
                </DialogPrimitive.Close>
              </div>
              <div className="flex min-h-0 flex-1 flex-col pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <NavegacionPrincipal
                  alNavegar={() => setDrawerAbierto(false)}
                  etiquetaNav={t('nav.principalMovil')}
                  sufijoId="nav-movil"
                />
              </div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>

          {/* ── Contenido ──────────────────────────────────────── */}
          <div className="flex min-w-0 flex-1 flex-col">
            {/* FS5: por encima de la cabecera, para que se vea en cualquier ruta. */}
            <AvisoExpiracionSesion />
            <AvisoDatosSimulados />
            <AvisosTiempoReal />
            <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/85 px-3 backdrop-blur-md sm:px-6 lg:px-8">
              <DialogPrimitive.Trigger
                aria-label={t('nav.abrirMenu')}
                className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors hover:bg-cream-200/70 hover:text-foreground lg:hidden"
              >
                <MenuIcono className="size-5" aria-hidden />
              </DialogPrimitive.Trigger>

              <ColdCareBrand className="lg:hidden [&_svg]:size-8 max-[399px]:[&>div]:hidden" />

              <div className="hidden min-w-0 items-center gap-3 lg:flex">
                <p className="flex min-w-0 items-center gap-1.5 text-sm">
                  {seccionActual && (
                    <>
                      <span className="truncate text-faint">{t(seccionActual.claveI18n)}</span>
                      <ChevronRight className="size-3.5 shrink-0 text-faint" aria-hidden />
                    </>
                  )}
                  <span className="truncate font-semibold text-foreground">
                    {rutaActual ? t(rutaActual.claveI18n) : t('app.nombre')}
                  </span>
                </p>
                <span aria-hidden className="h-4 w-px bg-border" />
                <p className="text-xs text-faint first-letter:uppercase">{fechaHoy}</p>
              </div>

              <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
                <BadgeDemo className="mr-1.5 hidden sm:inline-flex" />
                <LanguageSwitcher />
                <ThemeSwitcher />
                <span aria-hidden className="mx-1 hidden h-5 w-px bg-border sm:block" />
                <MenuUsuario />
              </div>
            </header>

            <main
              id="contenido-principal"
              tabIndex={-1}
              aria-label={t('nav.contenidoPrincipal')}
              className="min-w-0 flex-1 overflow-x-clip px-4 py-5 focus:outline-none sm:px-6 sm:py-6 lg:px-8 lg:py-7"
            >
              {/* Tope de ancho: en monitores muy anchos el contenido no se estira sin fin */}
              <div className="mx-auto w-full max-w-[1560px]">
                <motion.div
                  key={pathname}
                  // Con movimiento reducido la página aparece sin transición.
                  initial={reducir ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={ENTRADA_PAGINA}
                >
                  <Outlet />
                </motion.div>
              </div>
            </main>
          </div>
        </DialogPrimitive.Root>
      </div>
    </TooltipProvider>
  )
}
