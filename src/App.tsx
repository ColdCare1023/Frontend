import { Suspense, lazy, useEffect, type ComponentType, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'

import { setOnSesionExpirada } from '@/infrastructure/api/apiClient'
import { marcarSesionExpirada } from '@/infrastructure/auth/avisoSesion'
import { useAuthStore } from '@/application/stores/authStore'
import { ErrorBoundary } from '@/presentation/components/ErrorBoundary'
import { RequireAuth, RequireRoles } from '@/presentation/components/RouteGuards'
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
 * RNF-10 (carga ≤ 3 s). El layout y el modal de privacidad se importaban de
 * forma directa, así que la pantalla de login —la única que ve quien todavía
 * no ha entrado— arrastraba Radix Dialog, el bloqueo de scroll y los doce
 * iconos de la navegación antes de poder pintar el formulario. Ninguno de los
 * dos hace falta hasta después de autenticarse.
 */
const AppLayout = diferida(() => import('@/presentation/layouts/AppLayout'), 'AppLayout')
const PrivacyConsentModal = diferida(
  () => import('@/presentation/components/PrivacyConsentModal'),
  'PrivacyConsentModal',
)

const GuiaPage = diferida(() => import('@/presentation/pages/GuiaPage'), 'GuiaPage')
const DashboardPage = diferida(() => import('@/presentation/pages/DashboardPage'), 'DashboardPage')
const HistorialPage = diferida(() => import('@/presentation/pages/HistorialPage'), 'HistorialPage')
const AlertasPage = diferida(() => import('@/presentation/pages/AlertasPage'), 'AlertasPage')
const TrazabilidadPage = diferida(
  () => import('@/presentation/pages/TrazabilidadPage'),
  'TrazabilidadPage',
)
const ChecklistBPAPage = diferida(
  () => import('@/presentation/pages/ChecklistBPAPage'),
  'ChecklistBPAPage',
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
const FirmwarePage = diferida(() => import('@/presentation/pages/FirmwarePage'), 'FirmwarePage')

/**
 * El respaldo de `Suspense` era un «…» suelto: sin texto real y sin rol, el
 * lector de pantalla solo percibía que la página se había vaciado. WCAG 4.1.3
 * pide que un cambio de estado como «cargando» se comunique sin robar el foco,
 * de ahí `role="status"`.
 */
function RespaldoCarga() {
  const { t } = useTranslation()
  return (
    <p role="status" aria-live="polite" className="animate-fade p-8 text-sm text-muted">
      {t('app.cargando')}
    </p>
  )
}

function Pagina({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RespaldoCarga />}>{children}</Suspense>
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
  const requierePrivacidad = useAuthStore((s) => s.requierePrivacidad)

  return (
    // Envuelve el router entero: una excepción durante el render dejaba antes
    // la pantalla en blanco, sin indicio de si el monitoreo seguía activo.
    <ErrorBoundary>
      <BrowserRouter>
        <SesionExpiradaListener />
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<RequireAuth />}>
            <Route element={<Pagina><AppLayout /></Pagina>}>
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

              {/* El checklist BPA no está en la matriz de AUDITOR en el
                  backend (checklist_router.py solo admite FARMACEUTICO /
                  ADMINISTRADOR): queda fuera del grupo de arriba a propósito. */}
              <Route element={<RequireRoles roles={['farmaceutico']} />}>
                <Route path="/checklist-bpa" element={<Pagina><ChecklistBPAPage /></Pagina>} />
              </Route>

              {/* HU-41: la bitácora de auditoría es justamente lo que un
                  AUDITOR necesita leer (require_roles(ADMINISTRADOR, AUDITOR)
                  en auditoria_router.py). */}
              <Route element={<RequireRoles roles={['auditor']} />}>
                <Route path="/auditoria" element={<Pagina><AuditoriaPage /></Pagina>} />
              </Route>

              {/* Gestión de usuarios/dispositivos/firmware: sigue siendo
                  exclusiva del administrador — el backend no le da AUDITOR
                  acceso de escritura ni de lectura a estas pantallas
                  completas (solo a un sub-recurso puntual de dispositivos,
                  el historial de configuración, sin UI propia todavía). */}
              <Route element={<RequireRoles roles={[]} />}>
                <Route path="/usuarios" element={<Pagina><UsuariosPage /></Pagina>} />
                <Route path="/dispositivos" element={<Pagina><DispositivosPage /></Pagina>} />
                <Route path="/firmware" element={<Pagina><FirmwarePage /></Pagina>} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        {requierePrivacidad && (
          <Suspense fallback={null}>
            <PrivacyConsentModal />
          </Suspense>
        )}
      </BrowserRouter>
    </ErrorBoundary>
  )
}
