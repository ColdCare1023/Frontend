import { Navigate, Outlet, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ShieldAlert } from 'lucide-react'

import { useAuthStore } from '@/application/stores/authStore'
import { tienePermiso, type Rol } from '@/domain/value-objects/Rol'
import { Button } from './ui/button'

/** Redirige a /login si no hay sesión activa. */
export function RequireAuth() {
  const autenticado = useAuthStore((s) => s.autenticado)
  if (!autenticado) return <Navigate to="/login" replace />
  return <Outlet />
}

/**
 * FE-004: con una contraseña temporal pendiente, la única pantalla útil es la
 * del cambio (el backend responde 403 a todo lo demás).
 */
export function RequirePasswordPropia() {
  const requiereCambio = useAuthStore((s) => s.requiereCambioPassword)
  if (requiereCambio) return <Navigate to="/cambiar-password" replace />
  return <Outlet />
}

/**
 * HU-44 / FE-005: mientras falte el consentimiento, el backend responde 403 a
 * todo. Las pantallas no se montan hasta aceptarlo: antes pedían sus datos
 * detrás del aviso, mostraban «No pudimos cargar…» y el flujo SSE quedaba en
 * reintentos; al aceptar ahora cargan limpias con datos reales.
 */
export function RequireConsentimiento() {
  const requierePrivacidad = useAuthStore((s) => s.requierePrivacidad)
  if (requierePrivacidad) return null
  return <Outlet />
}

/** Bloquea la ruta si el rol del usuario no está permitido (RBAC). */
export function RequireRoles({ roles }: { roles: Rol[] }) {
  const { t } = useTranslation()
  const usuario = useAuthStore((s) => s.usuario)
  const navigate = useNavigate()

  if (!usuario) return <Navigate to="/login" replace />

  if (!tienePermiso(usuario.rol, roles)) {
    // H15: la pantalla dice dónde está la persona, por qué no puede seguir y
    // le da una salida; antes solo había un icono y una frase.
    return (
      <section aria-labelledby="titulo-sin-permiso" className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-24 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-warning-100 text-warning-700">
          <ShieldAlert className="size-6" aria-hidden />
        </span>
        <h1 id="titulo-sin-permiso" className="font-display text-xl font-semibold tracking-tight text-foreground">
          {t('comunes.sinPermisoTitulo')}
        </h1>
        <p className="text-sm text-muted">{t('comunes.sinPermiso')}</p>
        <Button variant="secondary" size="sm" className="mt-2" onClick={() => navigate('/dashboard')}>
          {t('comunes.volverMonitoreo')}
        </Button>
      </section>
    )
  }
  return <Outlet />
}
