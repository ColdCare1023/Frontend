import { useState, useRef, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, CheckCircle2, Loader2, Mail, ShieldAlert } from 'lucide-react'

import { solicitarRecuperacion } from '@/infrastructure/auth/credencialesService'
import { AuthShell } from '../components/auth/AuthShell'
import { ColdCareBrandPanel } from '../components/auth/ColdCareBrandPanel'
import { Input, Label } from '../components/ui/input'

export function RecuperarContrasenaPage() {
  const { t } = useTranslation()
  const emailRef = useRef<HTMLInputElement>(null)
  const [email, setEmail] = useState('')
  const [cargando, setCargando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const manejarEnvio = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const normalizado = email.trim()
    if (!normalizado) {
      setError(t('login.errorEmailVacio'))
      emailRef.current?.focus()
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizado)) {
      setError(t('login.errorEmailInvalido'))
      emailRef.current?.focus()
      return
    }

    // FE-004: solicitud real (BE-025). La respuesta no revela si la cuenta
    // existe; sin SMTP en el servidor, la recuperación pasa por el
    // administrador.
    setCargando(true)
    const resultado = await solicitarRecuperacion(normalizado)
    setCargando(false)
    if (resultado === 'enviado') setEnviado(true)
    else if (resultado === 'no_disponible') setError(t('recuperarContrasena.noDisponible'))
    else if (resultado === 'limite') setError(t('login.errorDemasiadosIntentos'))
    else setError(t('login.errorServidor'))
  }

  return (
    <AuthShell brandPanel={<ColdCareBrandPanel />}>
      <div className="flex flex-col">
        <div>
          {/* Cabecera */}
          <div className="mb-7">
            <Link
              to="/login"
              className="mb-5 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              <span>{t('recuperarContrasena.volverLogin')}</span>
            </Link>
            <h2 className="text-[28px] leading-[34px] font-bold tracking-tight text-foreground sm:text-[32px] sm:leading-10">
              {t('recuperarContrasena.titulo')}
            </h2>
            <p className="mt-2 text-base leading-6 text-muted">
              {t('recuperarContrasena.subtitulo')}
            </p>
          </div>

          {enviado ? (
            /* Estado de confirmación (anti-enumeración) */
            <div className="space-y-6 animate-fade">
              <div className="rounded-2xl border border-border bg-secondary-tint/60 p-5">
                <div className="flex items-start gap-3.5">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary-tint text-glacier-700">
                    <CheckCircle2 className="size-5" aria-hidden />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-base font-bold text-foreground">
                      {t('recuperarContrasena.exitoTitulo')}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted">
                      {t('recuperarContrasena.exitoMensaje', { email })}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-cream-100/50 p-4 text-xs text-muted flex items-start gap-2.5">
                <ShieldAlert className="size-4 shrink-0 text-faint mt-0.5" aria-hidden />
                <p>{t('recuperarContrasena.notaSeguridad')}</p>
              </div>

              <div className="pt-2 flex flex-col gap-3">
                <Link
                  to="/login"
                  className="flex h-11 w-full items-center justify-center rounded-xl coldcare-primary-action px-4 text-sm font-semibold text-white shadow-(--shadow-card) hover:shadow-(--shadow-card) transition-all"
                >
                  {t('recuperarContrasena.volverLogin')}
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setEnviado(false)
                    setEmail('')
                  }}
                  className="text-xs font-semibold text-primary hover:underline self-center py-1 cursor-pointer"
                >
                  {t('recuperarContrasena.enviarOtro')}
                </button>
              </div>
            </div>
          ) : (
            /* Formulario para ingresar correo */
            <form onSubmit={manejarEnvio} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="recuperar-email">{t('recuperarContrasena.email')}</Label>
                <div className="relative">
                  <Input
                    ref={emailRef}
                    id="recuperar-email"
                    type="email"
                    autoComplete="email"
                    placeholder={t('recuperarContrasena.emailPlaceholder', {
                      defaultValue: 'tu.correo@farmacia.pe',
                    })}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={Boolean(error)}
                    required
                  />
                  <Mail className="absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-muted pointer-events-none" />
                </div>
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-xl border border-clay-100 bg-clay-100/60 px-3.5 py-2.5 text-sm text-clay-700 animate-fade"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={cargando}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl coldcare-primary-action px-4 text-sm font-semibold text-white shadow-(--shadow-card) transition-all duration-200 hover:shadow-(--shadow-card) active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60 cursor-pointer"
              >
                {cargando ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    <span>{t('recuperarContrasena.enviando')}</span>
                  </>
                ) : (
                  <span>{t('recuperarContrasena.enviar')}</span>
                )}
              </button>

              <p className="pt-2 text-xs text-faint leading-relaxed text-center">
                {t('recuperarContrasena.notaSeguridad')}
              </p>
            </form>
          )}
        </div>

        <div className="pt-6 text-center text-xs text-muted">
          <Link
            to="/login"
            className="font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary rounded-sm"
          >
            ← {t('recuperarContrasena.volverLogin')}
          </Link>
        </div>
      </div>
    </AuthShell>
  )
}
