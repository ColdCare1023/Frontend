import { Suspense, lazy, useEffect, type ComponentType, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'

import { setOnSesionExpirada } from '@/infrastructure/api/apiClient'
import { marcarSesionExpirada } from '@/infrastructure/auth/avisoSesion'
import { useAuthStore } from '@/application/stores/authStore'
import { ErrorBoundary } from '@/presentation/components/ErrorBoundary'
import { RequireAuth, RequirePasswordPropia, RequireRoles } from '@/presentation/components/RouteGuards'
import { CambiarPasswordPage } from '@/presentation/pages/CambiarPasswordPage'
import { LoginPage } from '@/presentation/pages/LoginPage'
import { RecuperarContrasenaPage } from '@/presentation/pages/RecuperarContrasenaPage'
import { RestablecerContrasenaPage } from '@/presentation/pages/RestablecerContrasenaPage'

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
const AppLayout = diferida(() => import('@/presentation/layouts/AppLayout'), 'AppLayout')

const GuiaPage = diferida(() => import('@/presentation/pages/GuiaPage'), 'GuiaPage')
const DashboardPage = diferida(() => import('@/presentation/pages/DashboardPage'), 'DashboardPage')
const HistorialPage = diferida(() => import('@/presentation/pages/HistorialPage'), 'HistorialPage')
const AlertasPage = diferida(() => import('@/presentation/pages/AlertasPage'), 'AlertasPage')
const TrazabilidadPage = diferida(
  () => import('@/presentation/pages/TrazabilidadPage'),
  'TrazabilidadPage',
)
const ReportesPage = diferida(() => import('@/presentation/pages/ReportesPage'), 'ReportesPage')
const MetricasIAPage = diferida(
  () => import('@/presentation/pages/MetricasIAPage'),
  'MetricasIAPage',
)
const AuditoriaPage = diferida(() => import('@/presentation/pages/AuditoriaPage'), 'AuditoriaPage')
const UsuariosPage = diferida(() => import('@/presentation/pages/UsuariosPage'), 'UsuariosPage')
const DispositivosPage = diferida(
  () => import('@/presentation/pages/DispositivosPage'),
  'DispositivosPage',
)
/** Holds a stable shell while a protected route's code loads. */
function RespaldoCarga({ shell = false }: { shell?: boolean }) {
  const { t } = useTranslation()
  if (shell) {
    return (
      <div role="status" aria-live="polite" aria-busy="true" className="min-h-dvh bg-background">
        <span className="sr-only">{t('app.cargando')}</span>
        <aside aria-hidden className="fixed inset-y-0 left-0 hidden w-60 border-r border-border bg-surface p-6 lg:block">
          <div className="h-10 w-36 rounded-lg bg-cream-200" />
          <div className="mt-12 space-y-5">{Array.from({ length: 9 }, (_, i) => <div key={i} className="h-4 w-40 rounded bg-cream-200" />)}</div>
        </aside>
        <header aria-hidden className="h-14 border-b border-border bg-surface lg:ml-60" />
        <main aria-hidden className="space-y-5 p-4 sm:p-6 lg:ml-60 lg:p-8">
          <div className="h-8 w-64 max-w-full rounded bg-cream-200" />
          <div className="h-4 w-96 max-w-full rounded bg-cream-200" />
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="h-4 w-40 rounded bg-cream-200" />
            <div className="mt-6 flex flex-wrap gap-3"><div className="h-11 w-40 rounded bg-cream-100" /><div className="h-11 w-40 rounded bg-cream-100" /><div className="h-11 w-40 rounded bg-cream-100" /></div>
          </div>
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="h-4 w-48 rounded bg-cream-200" />
            <div className="mt-8 flex h-20 items-end gap-3 border-b border-border px-3">{[35, 62, 48, 76, 56, 88, 68, 96, 52, 72, 44, 82].map((height, i) => <span key={i} className="flex-1 rounded-t bg-cream-200" style={{ height: `${height}%` }} />)}</div>
            <div className="mt-5 space-y-3">{[0, 1, 2].map((i) => <div key={i} className="flex gap-4"><div className="h-3 w-32 rounded bg-cream-100" /><div className="h-3 w-48 rounded bg-cream-100" /></div>)}</div>
          </div>
        </main>
      </div>
    )
  }
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="min-h-[280px] space-y-5">
      <span className="sr-only">{t('app.cargando')}</span>
      <div aria-hidden className="h-8 w-64 max-w-full rounded bg-cream-200" />
      <div aria-hidden className="h-4 w-96 max-w-full rounded bg-cream-200" />
      <div aria-hidden className="rounded-xl border border-border bg-surface p-5">
        <div className="h-4 w-40 rounded bg-cream-200" />
        <div className="mt-6 flex flex-wrap gap-3"><div className="h-11 w-40 rounded bg-cream-100" /><div className="h-11 w-40 rounded bg-cream-100" /><div className="h-11 w-40 rounded bg-cream-100" /></div>
      </div>
      <div aria-hidden className="rounded-xl border border-border bg-surface p-5">
        <div className="h-4 w-48 rounded bg-cream-200" />
        <div className="mt-8 flex h-20 items-end gap-3 border-b border-border px-3">{[35, 62, 48, 76, 56, 88, 68, 96, 52, 72, 44, 82].map((height, i) => <span key={i} className="flex-1 rounded-t bg-cream-200" style={{ height: `${height}%` }} />)}</div>
        <div className="mt-5 space-y-3">{[0, 1, 2].map((i) => <div key={i} className="flex gap-4"><div className="h-3 w-32 rounded bg-cream-100" /><div className="h-3 w-48 rounded bg-cream-100" /></div>)}</div>
      </div>
    </div>
  )
}

function Pagina({ children, shell = false }: { children: ReactNode; shell?: boolean }) {
  return <Suspense fallback={<RespaldoCarga shell={shell} />}>{children}</Suspense>
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

  return null
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
          <Route path="/recuperar-contrasena" element={<RecuperarContrasenaPage />} />
          <Route path="/restablecer-password" element={<RestablecerContrasenaPage />} />

          <Route element={<RequireAuth />}>
            <Route path="/cambiar-password" element={<CambiarPasswordPage />} />
            <Route element={<RequirePasswordPropia />}>
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

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
