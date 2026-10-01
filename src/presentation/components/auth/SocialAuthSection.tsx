import { useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { motion, useReducedMotion } from 'motion/react'
import { AlertCircle, ArrowRight, Loader2, ShieldAlert, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  googleAuthAdapter,
  facebookAuthAdapter,
  type SocialUser,
} from '@/infrastructure/auth/socialAuthAdapters'

interface SocialAuthSectionProps {
  onSuccess: (token: string) => void
  disabled?: boolean
  hintEmail?: string
  className?: string
}

/** Icono oficial SVG de Google (4 colores auténticos según directrices de marca) */
function GoogleOfficialIcon({ className = 'size-4 shrink-0' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>
  )
}

/** Icono oficial SVG de Facebook (#1877F2 azul auténtico según directrices de marca) */
function FacebookOfficialIcon({ className = 'size-4 shrink-0' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="#1877F2" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

/**
 * Sección de Autenticación Social (Google y Facebook).
 * Inspirada en patrones de Origin UI / shadcn/ui con:
 * - Separador sutil "o continúa con".
 * - Botones accesibles con logotipos oficiales intactos.
 * - Validación estricta RBAC: Si la cuenta federada no está en la nómina de ColdCare,
 *   se presenta un aviso contextual y un enlace directo a "Solicitar acceso".
 */
export function SocialAuthSection({
  onSuccess,
  disabled = false,
  hintEmail,
  className,
}: SocialAuthSectionProps) {
  const { t } = useTranslation()
  const shouldReduceMotion = useReducedMotion()

  const [proveedorEnCarga, setProveedorEnCarga] = useState<'google' | 'facebook' | null>(null)
  const [cuentaNoAutorizada, setCuentaNoAutorizada] = useState<{
    proveedor: 'Google' | 'Facebook'
    user: SocialUser
  } | null>(null)
  const [errorSocial, setErrorSocial] = useState<string | null>(null)

  const manejarAutenticacion = async (proveedor: 'google' | 'facebook') => {
    if (disabled || proveedorEnCarga) return
    setErrorSocial(null)
    setCuentaNoAutorizada(null)
    setProveedorEnCarga(proveedor)

    try {
      const adapter = proveedor === 'google' ? googleAuthAdapter : facebookAuthAdapter
      const resultado = await adapter.authenticate(hintEmail)

      if (resultado.status === 'success' && resultado.accessToken) {
        onSuccess(resultado.accessToken)
      } else if (resultado.status === 'not_authorized' && resultado.user) {
        setCuentaNoAutorizada({
          proveedor: proveedor === 'google' ? 'Google' : 'Facebook',
          user: resultado.user,
        })
      } else {
        setErrorSocial(
          resultado.errorMessage ??
            t('login.errorAutenticacionSocial', {
              defaultValue: 'No se pudo completar la autenticación con el proveedor.',
            }),
        )
      }
    } catch {
      setErrorSocial(
        t('login.errorAutenticacionSocial', {
          defaultValue: 'No se pudo conectar con el servicio de autenticación.',
        }),
      )
    } finally {
      setProveedorEnCarga(null)
    }
  }

  const animacionBoton = shouldReduceMotion
    ? undefined
    : {
        whileHover: { y: -1, transition: { duration: 0.15 } },
        whileTap: { scale: 0.98, transition: { duration: 0.08 } },
      }

  return (
    <div className={cn('space-y-3.5', className)}>
      {/* Separador "o continúa con" */}
      <div className="relative my-4 flex items-center justify-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <span className="relative bg-white/95 px-3 text-[11px] font-medium uppercase tracking-wider text-muted backdrop-blur-xs">
          {t('login.continuarCon', { defaultValue: 'o continúa con' })}
        </span>
      </div>

      {/* Notificación informativa si la cuenta federada no tiene rol asignado en ColdCare */}
      {cuentaNoAutorizada && (
        <div
          role="status"
          aria-live="polite"
          className="relative rounded-xl border border-blue-200 bg-blue-50/90 p-3.5 text-xs text-blue-900 shadow-xs animate-fade"
        >
          <button
            type="button"
            onClick={() => setCuentaNoAutorizada(null)}
            className="absolute right-2 top-2 p-1 text-blue-600 hover:text-blue-800 rounded-md focus-visible:outline-2 focus-visible:outline-blue-600"
            aria-label="Cerrar aviso"
          >
            <X className="size-3.5" />
          </button>

          <div className="flex items-start gap-2.5 pr-5">
            <ShieldAlert className="size-4 shrink-0 text-blue-600 mt-0.5" aria-hidden />
            <div className="space-y-1">
              <p className="font-semibold text-blue-950">
                {t('login.cuentaAutenticadaSinAcceso', {
                  defaultValue: 'Tu cuenta se autenticó correctamente, pero aún no tiene acceso al sistema.',
                })}
              </p>
              <p className="text-[11px] text-blue-800 leading-normal">
                {t('login.detalleCuentaFederada', {
                  email: cuentaNoAutorizada.user.email,
                  proveedor: cuentaNoAutorizada.proveedor,
                  defaultValue: `La cuenta ${cuentaNoAutorizada.user.email} (${cuentaNoAutorizada.proveedor}) no está vinculada a ningún rol activo en esta farmacia.`,
                })}
              </p>
              <div className="pt-1">
                <Link
                  to={`/solicitar-acceso?email=${encodeURIComponent(cuentaNoAutorizada.user.email)}`}
                  className="inline-flex items-center gap-1 font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <span>{t('login.solicitarAccesoBoton', { defaultValue: 'Solicitar acceso al administrador' })}</span>
                  <ArrowRight className="size-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alerta de error en autenticación social */}
      {errorSocial && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-clay-100 bg-clay-100/70 p-3 text-xs text-clay-700 animate-fade"
        >
          <AlertCircle className="size-4 shrink-0 text-clay-600" aria-hidden />
          <span className="flex-1">{errorSocial}</span>
          <button
            type="button"
            onClick={() => setErrorSocial(null)}
            className="p-0.5 text-clay-600 hover:text-clay-800 rounded-sm"
            aria-label="Cerrar error"
          >
            <X className="size-3" />
          </button>
        </div>
      )}

      {/* Botones de Proveedores Sociales */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {/* Botón Google */}
        <motion.button
          type="button"
          disabled={disabled || proveedorEnCarga !== null}
          whileHover={animacionBoton?.whileHover}
          whileTap={animacionBoton?.whileTap}
          onClick={() => void manejarAutenticacion('google')}
          aria-label={t('login.continuarGoogle', { defaultValue: 'Continuar con Google' })}
          className={cn(
            'flex h-11 sm:h-12 items-center justify-center gap-2.5 rounded-xl border border-border/90 bg-white px-3.5 text-[13px] font-medium text-foreground shadow-xs transition-colors',
            'hover:border-primary/50 hover:bg-slate-50/90 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
            'disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer',
          )}
        >
          {proveedorEnCarga === 'google' ? (
            <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
          ) : (
            <GoogleOfficialIcon className="size-4 shrink-0" />
          )}
          <span>{t('login.continuarGoogle', { defaultValue: 'Continuar con Google' })}</span>
        </motion.button>

        {/* Botón Facebook */}
        <motion.button
          type="button"
          disabled={disabled || proveedorEnCarga !== null}
          whileHover={animacionBoton?.whileHover}
          whileTap={animacionBoton?.whileTap}
          onClick={() => void manejarAutenticacion('facebook')}
          aria-label={t('login.continuarFacebook', { defaultValue: 'Continuar con Facebook' })}
          className={cn(
            'flex h-11 sm:h-12 items-center justify-center gap-2.5 rounded-xl border border-border/90 bg-white px-3.5 text-[13px] font-medium text-foreground shadow-xs transition-colors',
            'hover:border-[#1877F2]/50 hover:bg-slate-50/90 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1877F2]',
            'disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer',
          )}
        >
          {proveedorEnCarga === 'facebook' ? (
            <Loader2 className="size-4 animate-spin text-[#1877F2]" aria-hidden />
          ) : (
            <FacebookOfficialIcon className="size-4 shrink-0" />
          )}
          <span>{t('login.continuarFacebook', { defaultValue: 'Continuar con Facebook' })}</span>
        </motion.button>
      </div>
    </div>
  )
}
