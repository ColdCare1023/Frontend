import { Suspense, lazy, useEffect, type ComponentType, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'

import { setOnPrivacidadRequerida, setOnSesionExpirada } from '@/infrastructure/api/apiClient'
import { marcarSesionExpirada } from '@/infrastructure/auth/avisoSesion'
import { useAuthStore } from '@/application/stores/authStore'
import { ErrorBoundary } from '@/presentation/components/ErrorBoundary'
import { RequireAuth, RequireConsentimiento, RequirePasswordPropia, RequireRoles } from '@/presentation/components/RouteGuards'
import { LoginPage } from '@/presentation/pages/LoginPage'

/**
 * Carga diferida por ruta (F-11). El dashboard arrastra ECharts (~600 KB), que
 * antes entraba en el paquete inicial y retrasaba incluso la pantalla de login.
 *
 * Las páginas exportan con nombre, así que hay que reempaquetarlas como
 * `default` para `React.lazy`.
 */
function diferida<T extends Record<string, ComponentType>>(
  cargar: () => Promise<T>,
  nombre: keyof T,
) {
  return lazy(async () => ({ default: (await cargar())[nombre] }))
}

/**
 * RNF-10 (carga ≤ 3 s). El layout se carga al autenticarse para que login no
 * descargue navegación ni las páginas protegidas antes de necesitarlas.
 */
const PANTALLAS = {
  '/guia': () => import('@/presentation/pages/GuiaPage'),
  '/dashboard': () => import('@/presentation/pages/DashboardPage'),
  '/historial': () => import('@/presentation/pages/HistorialPage'),
  '/alertas': () => import('@/presentation/pages/AlertasPage'),
  '/trazabilidad': () => import('@/presentation/pages/TrazabilidadPage'),
  '/reportes': () => import('@/presentation/pages/ReportesPage'),
  '/metricas-ia': () => import('@/presentation/pages/MetricasIAPage'),
  '/auditoria': () => import('@/presentation/pages/AuditoriaPage'),
  '/usuarios': () => import('@/presentation/pages/UsuariosPage'),
  '/dispositivos': () => import('@/presentation/pages/DispositivosPage'),
}

/**
 * La pantalla se pide a la vez que el marco. Si no, primero se descarga el marco y solo al montarse
 * pide su pantalla: una espera detrás de otra, ~0,7 s de más en un 4G lento.
 */
function precargarPantallaActual() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  const ruta = window.location.pathname.slice(base.length) as keyof typeof PANTALLAS
  PANTALLAS[ruta]?.().catch(() => undefined)
}

const AppLayout = diferida(() => {
  precargarPantallaActual()
  return import('@/presentation/layouts/AppLayout')
}, 'AppLayout')

// Los otros flujos de cuenta y el aviso de privacidad tampoco van en el paquete inicial: casi ninguna
// visita los usa. El login sí: la sesión vive en memoria y toda visita empieza por él. Medido con la
// CPU frenada ×4, cargarlo aparte retrasaba el primer pintado de ~210 ms a ~480 ms sin ahorrar bytes.
const RecuperarContrasenaPage = diferida(() => import('@/presentation/pages/RecuperarContrasenaPage'), 'RecuperarContrasenaPage')
const RestablecerContrasenaPage = diferida(() => import('@/presentation/pages/RestablecerContrasenaPage'), 'RestablecerContrasenaPage')
const CambiarPasswordPage = diferida(() => import('@/presentation/pages/CambiarPasswordPage'), 'CambiarPasswordPage')
const PrivacyConsentModal = diferida(() => import('@/presentation/components/PrivacyConsentModal'), 'PrivacyConsentModal')

const GuiaPage = diferida(PANTALLAS['/guia'], 'GuiaPage')
const DashboardPage = diferida(PANTALLAS['/dashboard'], 'DashboardPage')
const HistorialPage = diferida(PANTALLAS['/historial'], 'HistorialPage')
const AlertasPage = diferida(PANTALLAS['/alertas'], 'AlertasPage')
const TrazabilidadPage = diferida(PANTALLAS['/trazabilidad'], 'TrazabilidadPage')
const ReportesPage = diferida(PANTALLAS['/reportes'], 'ReportesPage')
const MetricasIAPage = diferida(PANTALLAS['/metricas-ia'], 'MetricasIAPage')
const AuditoriaPage = diferida(PANTALLAS['/auditoria'], 'AuditoriaPage')
const UsuariosPage = diferida(PANTALLAS['/usuarios'], 'UsuariosPage')
const DispositivosPage = diferida(PANTALLAS['/dispositivos'], 'DispositivosPage')

/** Holds a stable shell while a protected route's code loads. */
function RespaldoCarga({ shell = false }: { shell?: boolean }) {
  const { t } = useTranslation()
  const bloques = (
    <>
      <div className="esqueleto h-8 w-64 max-w-full rounded-md" />
      <div className="esqueleto h-4 w-96 max-w-full rounded" />
      <div className="superficie p-5">
        <div className="esqueleto h-4 w-40 rounded" />
        <div className="mt-6 flex flex-wrap gap-3"><div className="esqueleto h-10 w-40 rounded-md" /><div className="esqueleto h-10 w-40 rounded-md" /><div className="esqueleto h-10 w-40 rounded-md" /></div>
      </div>
      <div className="superficie p-5">
        <div className="esqueleto h-4 w-48 rounded" />
        <div className="mt-8 flex h-20 items-end gap-3 border-b border-border px-3">{[35, 62, 48, 76, 56, 88, 68, 96, 52, 72, 44, 82].map((height, i) => <span key={i} className="esqueleto flex-1 rounded-t" style={{ height: `${height}%` }} />)}</div>
        <div className="mt-5 space-y-3">{[0, 1, 2].map((i) => <div key={i} className="flex gap-4"><div className="esqueleto h-3 w-32 rounded" /><div className="esqueleto h-3 w-48 rounded" /></div>)}</div>
      </div>
    </>
  )
  if (shell) {
    // Las mismas cápsulas del marco, quietas, para que nada salte cuando carga.
    const capsula = 'h-12 rounded-full bg-[#05070c] shadow-(--shadow-card)'
    return (
      <div role="status" aria-live="polite" aria-busy="true" className="min-h-dvh bg-background">
        <span className="sr-only">{t('app.cargando')}</span>
        <div aria-hidden className="flex items-center justify-between gap-3 px-3 pt-2 sm:px-4">
          <div className={`${capsula} w-12 sm:w-36`} />
          <div className={`${capsula} hidden w-[440px] md:block`} />
          <div className={`${capsula} w-12 md:w-40`} />
        </div>
        <main aria-hidden className="mx-auto max-w-[1760px] space-y-5 px-4 py-8 sm:px-6 lg:px-10">{bloques}</main>
        <div aria-hidden className={`${capsula} fixed inset-x-4 bottom-3 md:hidden`} />
      </div>
    )
  }
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="min-h-[280px] space-y-5">
      <span className="sr-only">{t('app.cargando')}</span>
      <div aria-hidden className="space-y-5">{bloques}</div>
    </div>
  )
}

function Pagina({ children, shell = false }: { children: ReactNode; shell?: boolean }) {
  return <Suspense fallback={<RespaldoCarga shell={shell} />}>{children}</Suspense>
}

/** Las pantallas de cuenta son una hoja completa: mientras llega su código, solo el fondo y el aviso. */
function PaginaCuenta({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <Suspense
      fallback={
        <div role="status" aria-live="polite" aria-busy="true" className="min-h-dvh bg-background">
          <span className="sr-only">{t('app.cargando')}</span>
        </div>
      }
    >
      {children}
    </Suspense>
  )
}

function SesionExpiradaListener() {
  const navigate = useNavigate()
  const logout = useAuthStore((s) => s.logout)

  useEffect(() => {
    setOnSesionExpirada(() => {
      marcarSesionExpirada()
      // El token ya fue rechazado por el backend: pedir su revocación solo
      // produciría otro 401.
      logout({ revocar: false })
      void navigate('/login', { replace: true })
    })
  }, [logout, navigate])

  // FE-005: un 403 por consentimiento a mitad de sesión reabre el modal.
  useEffect(() => {
    setOnPrivacidadRequerida(() => useAuthStore.setState({ requierePrivacidad: true }))
  }, [])

  return null
}

/** FE-005: tras cambiar una contraseña temporal (FE-004), el consentimiento. */
function ConsentimientoPrivacidad() {
  const autenticado = useAuthStore((s) => s.autenticado)
  const requierePrivacidad = useAuthStore((s) => s.requierePrivacidad)
  const requiereCambioPassword = useAuthStore((s) => s.requiereCambioPassword)
  if (!autenticado || !requierePrivacidad || requiereCambioPassword) return null
  return <Suspense fallback={null}><PrivacyConsentModal /></Suspense>
}

export function App() {
  return (
    // Envuelve el router entero: una excepción durante el render dejaba antes
    // la pantalla en blanco, sin indicio de si el monitoreo seguía activo.
    <ErrorBoundary>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
        <SesionExpiradaListener />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          {/* FE-004: recuperación real (BE-025). No hay autorregistro ni
              "solicitud de acceso": las cuentas las crea el administrador. */}
          <Route path="/recuperar-contrasena" element={<PaginaCuenta><RecuperarContrasenaPage /></PaginaCuenta>} />
          <Route path="/restablecer-password" element={<PaginaCuenta><RestablecerContrasenaPage /></PaginaCuenta>} />

          <Route element={<RequireAuth />}>
            <Route path="/cambiar-password" element={<PaginaCuenta><CambiarPasswordPage /></PaginaCuenta>} />
            <Route element={<RequirePasswordPropia />}>
            <Route element={<RequireConsentimiento />}>
            <Route element={<Pagina shell><AppLayout /></Pagina>}>
              <Route path="/guia" element={<Pagina><GuiaPage /></Pagina>} />
              <Route path="/dashboard" element={<Pagina><DashboardPage /></Pagina>} />
              <Route path="/historial" element={<Pagina><HistorialPage /></Pagina>} />
              <Route path="/alertas" element={<Pagina><AlertasPage /></Pagina>} />
              <Route path="/trazabilidad" element={<Pagina><TrazabilidadPage /></Pagina>} />

              {/* HU-41: AUDITOR tiene acceso de solo lectura a reportes y
                  métricas IA, igual que el backend (require_roles(FARMACEUTICO,
                  AUDITOR) en reportes_router.py / ia_router.py). */}
              <Route element={<RequireRoles roles={['farmaceutico', 'auditor']} />}>
                <Route path="/reportes" element={<Pagina><ReportesPage /></Pagina>} />
                <Route path="/metricas-ia" element={<Pagina><MetricasIAPage /></Pagina>} />
              </Route>

              {/* HU-41: la bitácora de auditoría es justamente lo que un
                  AUDITOR necesita leer (require_roles(ADMINISTRADOR, AUDITOR)
                  en auditoria_router.py). */}
              <Route element={<RequireRoles roles={['auditor']} />}>
                <Route path="/auditoria" element={<Pagina><AuditoriaPage /></Pagina>} />
              </Route>

              {/* Gestión de usuarios/dispositivos: sigue siendo
                  exclusiva del administrador — el backend no le da AUDITOR
                  acceso de escritura ni de lectura a estas pantallas
                  completas (solo a un sub-recurso puntual de dispositivos,
                  el historial de configuración, sin UI propia todavía). */}
              <Route element={<RequireRoles roles={[]} />}>
                <Route path="/usuarios" element={<Pagina><UsuariosPage /></Pagina>} />
                <Route path="/dispositivos" element={<Pagina><DispositivosPage /></Pagina>} />
              </Route>
            </Route>
            </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        <ConsentimientoPrivacidad />
      </BrowserRouter>
    </ErrorBoundary>
  )
}
