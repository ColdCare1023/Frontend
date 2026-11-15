import { Link, Navigate, Outlet, useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ChevronRight } from 'lucide-react'

import { useAuthStore } from '@/application/stores/authStore'
import { tienePermiso, type Rol } from '@/domain/value-objects/Rol'
import { seccionesPermitidas } from '../navegacion'
import { IlustracionVacia } from './ui/ilustracion-vacia'

/**
 * Redirige a /login si no hay sesión activa. HU-52/HU-54: guarda el destino
 * (ruta y consulta, p. ej. `/alertas?id=…` del correo) para volver tras el login.
 */
export function RequireAuth() {
  const autenticado = useAuthStore((s) => s.autenticado)
  const ubicacion = useLocation()
  if (!autenticado) {
    return <Navigate to="/login" replace state={{ desde: `${ubicacion.pathname}${ubicacion.search}${ubicacion.hash}` }} />
  }
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

  if (!usuario) return <Navigate to="/login" replace />

  if (!tienePermiso(usuario.rol, roles)) {
    // H15: la pantalla dice dónde está la persona, por qué no puede seguir y
    // le ofrece los destinos que su rol sí abre (21st Empty States), en vez
    // de un callejón sin salida. Solo `comunes.sinPermiso` contiene «permiso».
    const secciones = seccionesPermitidas(usuario.rol)
    return (
      <section aria-labelledby="titulo-sin-permiso" className="mx-auto grid w-full max-w-5xl gap-6 py-4 sm:py-8">
        <div className="flex items-center gap-4 sm:gap-5">
          <IlustracionVacia variante="sin-permiso" />
          <div className="min-w-0 space-y-1">
            <h1 id="titulo-sin-permiso" className="font-display text-page text-foreground">
              {t('comunes.sinPermisoTitulo')}
            </h1>
            <p className="text-body text-muted">{t('comunes.sinPermiso')}</p>
            <p className="text-meta text-faint">{t('comunes.sinPermisoRol', { rol: t(`roles.${usuario.rol}`) })}</p>
          </div>
        </div>
        <div>
          <h2 className="mb-3 text-body font-semibold text-subtle">{t('comunes.sinPermisoDestinos')}</h2>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {secciones.map((seccion) => (
              <section key={seccion.claveI18n} aria-labelledby={`destinos-${seccion.claveI18n}`}>
                <h3 id={`destinos-${seccion.claveI18n}`} className="eyebrow mb-2">
                  {t(seccion.claveI18n)}
                </h3>
                <ul className="grid gap-2">
                  {seccion.items.map((item) => (
                    <li key={item.ruta}>
                      <Link
                        to={item.ruta}
                        className="superficie group flex min-h-14 items-center gap-3 px-4 py-3 transition-[background-color,transform] duration-(--duration-micro) ease-(--ease-out) hover:bg-surface-hover active:scale-[0.985] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        <item.icono aria-hidden className="size-[18px] shrink-0 text-faint group-hover:text-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-body font-medium text-foreground">{t(item.claveI18n)}</span>
                          <span className="block text-meta text-muted">{t(item.claveDescripcion)}</span>
                        </span>
                        <ChevronRight aria-hidden className="size-4 shrink-0 text-faint group-hover:text-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </section>
    )
  }
  return <Outlet />
}
