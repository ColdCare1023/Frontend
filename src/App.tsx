import { Suspense, lazy, useEffect, type ComponentType, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'

import { setOnPrivacidadRequerida, setOnSesionExpirada } from '@/infrastructure/api/apiClient'
import { marcarSesionExpirada } from '@/infrastructure/auth/avisoSesion'
import { useAuthStore } from '@/application/stores/authStore'
import { ErrorBoundary } from '@/presentation/components/ErrorBoundary'
import { PrivacyConsentModal } from '@/presentation/components/PrivacyConsentModal'
import { RequireAuth, RequireConsentimiento, RequirePasswordPropia, RequireRoles } from '@/presentation/components/RouteGuards'
import { CambiarPasswordPage } from '@/presentation/pages/CambiarPasswordPage'
import { CopiarCodigoPage } from '@/presentation/pages/CopiarCodigoPage'
import { LoginPage } from '@/presentation/pages/LoginPage'
import { RecuperarContrasenaPage } from '@/presentation/pages/RecuperarContrasenaPage'
import { ANCHO_COLAPSADO, ANCHO_EXPANDIDO, leerColapsado } from '@/presentation/layouts/preferenciaSidebar'
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
const ConfiguracionEquiposPage = diferida(
  () => import('@/presentation/pages/ConfiguracionEquiposPage'),
  'ConfiguracionEquiposPage',
)
const UsuariosPage = diferida(() => import('@/presentation/pages/UsuariosPage'), 'UsuariosPage')
const DispositivosLayout = diferida(
  () => import('@/presentation/pages/dispositivos/DispositivosLayout'),
  'DispositivosLayout',
)
const ListaDispositivosPage = diferida(
  () => import('@/presentation/pages/dispositivos/ListaDispositivosPage'),
  'ListaDispositivosPage',
)
const DetalleDispositivoPage = diferida(
  () => import('@/presentation/pages/dispositivos/DetalleDispositivoPage'),
  'DetalleDispositivoPage',
)
/** Holds a stable shell while a protected route's code loads. */
function RespaldoCarga({ shell = false }: { shell?: boolean }) {
  const { t } = useTranslation()
  const bloques = (
    <>
      <div className="esqueleto h-7 w-64 max-w-full rounded-(--radius-small)" />
      <div className="esqueleto h-16 w-full max-w-2xl rounded-(--radius-card)" />
      <div className="superficie p-4">
        <div className="esqueleto h-4 w-40 rounded" />
        <div className="mt-6 flex flex-wrap gap-3"><div className="esqueleto h-10 w-40 rounded-md" /><div className="esqueleto h-10 w-40 rounded-md" /><div className="esqueleto h-10 w-40 rounded-md" /></div>
      </div>
      <div className="superficie p-4">
        <div className="esqueleto h-4 w-48 rounded" />
        <div className="mt-8 flex h-20 items-end gap-3 border-b border-border px-3">{[35, 62, 48, 76, 56, 88, 68, 96, 52, 72, 44, 82].map((height, i) => <span key={i} className="esqueleto flex-1 rounded-t" style={{ height: `${height}%` }} />)}</div>
        <div className="mt-5 space-y-3">{[0, 1, 2].map((i) => <div key={i} className="flex gap-4"><div className="esqueleto h-3 w-32 rounded" /><div className="esqueleto h-3 w-48 rounded" /></div>)}</div>
      </div>
    </>
  )
  if (shell) {
    // Misma geometría que el shell real (riel 240/72 desde 1024, cabecera de
    // 56 con la píldora): sin salto al terminar de cargar.
    const ancho = leerColapsado() ? ANCHO_COLAPSADO : ANCHO_EXPANDIDO
    return (
      <div role="status" aria-live="polite" aria-busy="true" className="min-h-dvh lg:pl-(--ancho-riel)" style={{ '--ancho-riel': `${ancho}px` } as React.CSSProperties}>
        <span className="sr-only">{t('app.cargando')}</span>
        <aside aria-hidden className="fixed inset-y-0 left-0 hidden w-(--ancho-riel) border-r border-border bg-riel lg:block">
          <div className="flex h-14 items-center border-b border-border px-4"><div className="esqueleto h-8 w-full max-w-36 rounded-(--radius-field)" /></div>
          <div className="mt-5 space-y-4 px-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className="esqueleto h-4 w-full max-w-40 rounded" />)}</div>
        </aside>
        <header aria-hidden className="flex h-14 items-center justify-center border-b border-border bg-background px-4 sm:justify-end sm:px-6"><div className="esqueleto h-8 w-44 rounded-full" /></header>
        <main aria-hidden className="space-y-5 px-4 pt-5 sm:px-6 sm:pt-6 xl:px-8">{bloques}</main>
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
  return <PrivacyConsentModal />
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
          {/* Enlace «Copiar código» de los correos: el código viaja en el
              fragmento (#123456), que nunca llega al servidor. */}
          <Route path="/copiar-codigo" element={<CopiarCodigoPage />} />

          <Route element={<RequireAuth />}>
            <Route path="/cambiar-password" element={<CambiarPasswordPage />} />
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
                {/* HU-49: historial de configuración del hardware, de solo
                    lectura (require_roles(ADMINISTRADOR, AUDITOR) en
                    dispositivos_router.py /historial-configuracion). */}
                <Route path="/configuracion-equipos" element={<Pagina><ConfiguracionEquiposPage /></Pagina>} />
              </Route>

              {/* Gestión de usuarios/dispositivos: sigue siendo
                  exclusiva del administrador — el backend no le da AUDITOR
                  acceso de escritura ni de lectura a estas pantallas
                  completas (su sub-recurso, el historial de configuración,
                  tiene la vista propia de /configuracion-equipos). */}
              <Route element={<RequireRoles roles={[]} />}>
                <Route path="/usuarios" element={<Pagina><UsuariosPage /></Pagina>} />
                {/* Lista y detalle comparten la flota del layout (SPEC P5b §4.1). */}
                <Route path="/dispositivos" element={<Pagina><DispositivosLayout /></Pagina>}>
                  <Route index element={<Pagina><ListaDispositivosPage /></Pagina>} />
                  <Route path=":deviceId" element={<Pagina><DetalleDispositivoPage /></Pagina>} />
                </Route>
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
