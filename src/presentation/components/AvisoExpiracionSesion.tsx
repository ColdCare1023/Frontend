import { useCallback } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Clock } from 'lucide-react'

import { useAuthStore } from '@/application/stores/authStore'
import { formatearRestante, useExpiracionSesion } from '@/application/hooks/useExpiracionSesion'
import { marcarSesionExpirada } from '@/infrastructure/auth/avisoSesion'

/**
 * FS5 — banda de aviso cuando el JWT está a punto de caducar.
 *
 * Se muestra fija arriba y no como diálogo: bloquear la pantalla justo cuando
 * al usuario le quedan minutos para guardar sería contraproducente.
 */
export function AvisoExpiracionSesion() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const logout = useAuthStore((s) => s.logout)

  const alExpirar = useCallback(() => {
    marcarSesionExpirada()
    // El token ya caducó: el backend lo rechazaría, así que pedir su
    // revocación solo produciría un 401.
    logout({ revocar: false })
    void navigate('/login', { replace: true })
  }, [logout, navigate])

  const { porExpirar, restanteMs } = useExpiracionSesion(alExpirar)

  if (!porExpirar) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-40 flex items-center justify-center gap-2 border-b border-honey-600/25 bg-honey-100 px-4 py-2 text-[13px] text-honey-700 animate-rise"
    >
      <Clock className="size-3.5 shrink-0" aria-hidden />
      <span>{t('sesion.porExpirar', { restante: formatearRestante(restanteMs) })}</span>
    </div>
  )
}
