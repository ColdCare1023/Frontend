import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import { AlertCircle } from 'lucide-react'

import { cn } from '@/lib/utils'
import { GOOGLE_HABILITADO, montarBotonGoogle } from '@/infrastructure/auth/googleIdentity'

interface GoogleAuthSectionProps {
  /** Canjea el ID token en el backend y abre la sesión (authStore.loginConGoogle). */
  onIdToken: (idToken: string) => Promise<void>
  onExito: () => void
  className?: string
}

/**
 * FE-001: acceso con Google real (Google Identity Services + backend).
 *
 * Sustituye a los botones simulados de Google y Facebook, que fabricaban en el
 * navegador un JWT sin firma a partir del correo tecleado. Solo se renderiza
 * si el build tiene `VITE_GOOGLE_CLIENT_ID`; sin él no se contacta con Google.
 * Facebook se retira: el backend no lo respalda.
 */
export function GoogleAuthSection({ onIdToken, onExito, className }: GoogleAuthSectionProps) {
  const { t } = useTranslation()
  const contenedor = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!GOOGLE_HABILITADO || !contenedor.current) return
    let vigente = true

    montarBotonGoogle(contenedor.current, (idToken) => {
      if (!vigente) return
      setError(null)
      onIdToken(idToken)
        .then(() => {
          if (vigente) onExito()
        })
        .catch((err: unknown) => {
          if (!vigente) return
          // 401: la cuenta de Google es válida pero no está dada de alta (o
          // está desactivada). No es un fallo de contraseña.
          setError(
            axios.isAxiosError(err) && err.response?.status === 401
              ? t('login.googleNoAutorizado')
              : t('login.errorServidor'),
          )
        })
    }).catch(() => {
      if (vigente) setError(t('login.googleNoDisponible'))
    })

    return () => {
      vigente = false
    }
  }, [onIdToken, onExito, t])

  if (!GOOGLE_HABILITADO) return null

  return (
    <div className={cn('space-y-3.5', className)}>
      <div className="relative my-4 flex items-center justify-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <span className="relative bg-surface px-3 text-[11px] font-medium uppercase tracking-wider text-muted backdrop-blur-xs">
          {t('login.continuarCon')}
        </span>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-clay-100 bg-clay-100/70 p-3 text-xs text-clay-700 animate-fade"
        >
          <AlertCircle className="size-4 shrink-0 text-clay-600" aria-hidden />
          <span className="flex-1">{error}</span>
        </div>
      )}

      {/* Botón oficial renderizado por Google: su política de marca lo exige y
          el flujo de credenciales queda dentro de su iframe. */}
      <div ref={contenedor} data-testid="boton-google" className="flex min-h-11 justify-center" />
    </div>
  )
}
