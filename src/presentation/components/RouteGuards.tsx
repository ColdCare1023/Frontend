import { Navigate, Outlet } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ShieldAlert } from 'lucide-react'

import { useAuthStore } from '@/application/stores/authStore'
import { tienePermiso, type Rol } from '@/domain/value-objects/Rol'

/** Redirige a /login si no hay sesión activa. */
export function RequireAuth() {
  const autenticado = useAuthStore((s) => s.autenticado)
  if (!autenticado) return <Navigate to="/login" replace />
  return <Outlet />
}

/** Bloquea la ruta si el rol del usuario no está permitido (RBAC). */
export function RequireRoles({ roles }: { roles: Rol[] }) {
  const { t } = useTranslation()
  const usuario = useAuthStore((s) => s.usuario)

  if (!usuario) return <Navigate to="/login" replace />

  if (!tienePermiso(usuario.rol, roles)) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-honey-100 text-honey-700">
          <ShieldAlert className="size-6" />
        </span>
        <p className="text-sm text-muted">{t('comunes.sinPermiso')}</p>
      </div>
    )
  }
  return <Outlet />
}
