import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import axios from 'axios'

import { cn } from '@/lib/utils'
import { GOOGLE_HABILITADO, montarBotonGoogle } from '@/infrastructure/auth/googleIdentity'
import { AvisoAcceso } from './PiezasAcceso'

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
      <div className="flex items-center gap-3 text-[13px] text-faint">
        <span aria-hidden className="h-px flex-1 bg-border" />
        <span>{t('login.continuarCon')}</span>
        <span aria-hidden className="h-px flex-1 bg-border" />
      </div>

      {error && <AvisoAcceso tono="error">{error}</AvisoAcceso>}

      {/* Botón oficial renderizado por Google: su política de marca lo exige y
          el flujo de credenciales queda dentro de su iframe. */}
      <div ref={contenedor} data-testid="boton-google" className="flex min-h-11 justify-center" />
    </div>
  )
}
