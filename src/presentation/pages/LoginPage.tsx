import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import { FlaskConical, ThermometerSnowflake, ShieldCheck, Info } from 'lucide-react'

import { useAuthStore } from '@/application/stores/authStore'
import { consumirMotivoAviso, type MotivoAviso } from '@/infrastructure/auth/avisoSesion'
import { MODO_DEMO } from '@/infrastructure/demo/modoDemo'
import type { Rol } from '@/domain/value-objects/Rol'
import {
  GOOGLE_HABILITADO,
  montarBotonGoogle,
} from '@/infrastructure/auth/googleIdentity'
import { Button } from '../components/ui/button'
import { ColdCareBrand } from '../components/ColdCareBrand'
import { Input, Label } from '../components/ui/input'
import { LanguageSwitcher } from '../components/LanguageSwitcher'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.86c2.26-2.09 3.58-5.16 3.58-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.86-3c-1.07.72-2.45 1.15-4.08 1.15-3.13 0-5.78-2.12-6.73-4.96H1.29v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28V6.63H1.29a12 12 0 0 0 0 10.74l3.98-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.42-3.42A11.53 11.53 0 0 0 12 0 12 12 0 0 0 1.29 6.63l3.98 3.09C6.22 6.88 8.87 4.77 12 4.77Z"
      />
    </svg>
  )
}

const CUENTAS_DEMO: Array<{ rol: Rol; email: string }> = [
  { rol: 'farmaceutico', email: 'farmaceutico@demo.pe' },
  { rol: 'tecnico', email: 'tecnico@demo.pe' },
  { rol: 'administrador', email: 'admin@demo.pe' },
  { rol: 'auditor', email: 'auditor@demo.pe' },
]

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="#1877F2" aria-hidden>
      <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.7 4.53-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.09 24 18.1 24 12.07Z" />
    </svg>
  )
}

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const loginConGoogle = useAuthStore((s) => s.loginConGoogle)
  const contenedorGoogle = useRef<HTMLDivElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorEmail, setErrorEmail] = useState<string | null>(null)
  const [errorPassword, setErrorPassword] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [avisoOAuth, setAvisoOAuth] = useState<string | null>(null)
  const [motivoAviso, setMotivoAviso] = useState<MotivoAviso>(null)

  useEffect(() => {
    // StrictMode monta el efecto dos veces: la segunda lectura ya viene vacía
    // (el motivo se consume al leer), así que solo se asigna si hay valor.
    const motivo = consumirMotivoAviso()
    if (motivo) setMotivoAviso(motivo)
  }, [])

  const enviar = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setAvisoOAuth(null)

    const correo = email.trim()
    const siguienteErrorEmail = !correo
      ? t('login.errorEmailVacio')
      : emailRef.current?.validity.typeMismatch
        ? t('login.errorEmailInvalido')
        : null
    const siguienteErrorPassword = !password
      ? t('login.errorPasswordVacia')
      : password.length < 8
        ? t('login.errorPasswordCorta')
        : null
    setErrorEmail(siguienteErrorEmail)
    setErrorPassword(siguienteErrorPassword)

    if (siguienteErrorEmail || siguienteErrorPassword) {
      if (siguienteErrorEmail) emailRef.current?.focus()
      else passwordRef.current?.focus()
      return
    }

    setCargando(true)
    try {
      await login(correo, password)
      void navigate('/dashboard', { replace: true })
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        setError(t('login.errorCredenciales'))
      } else if (axios.isAxiosError(err) && err.response?.status === 429) {
        setError(t('login.errorDemasiadosIntentos'))
      } else {
        setError(t('login.errorServidor'))
      }
    } finally {
      setCargando(false)
    }
  }

  const oauthPendiente = (proveedor: string) => {
    setError(null)
    setAvisoOAuth(t('login.proveedorNoDisponible', { proveedor }))
  }

  // Monta el botón de Google solo si este build lo tiene configurado. Sin
  // `VITE_GOOGLE_CLIENT_ID` no se contacta con Google en absoluto: una
  // instalación que no usa el método no carga código de terceros.
  useEffect(() => {
    if (!GOOGLE_HABILITADO || !contenedorGoogle.current) return
    let vigente = true

    void montarBotonGoogle(contenedorGoogle.current, (idToken) => {
      if (!vigente) return
      setError(null)
      setAvisoOAuth(null)
      setCargando(true)
      loginConGoogle(idToken)
        .then(() => navigate('/dashboard', { replace: true }))
        .catch((err: unknown) => {
          // 401 aquí significa "esa cuenta no está dada de alta o está
          // desactivada", no "la contraseña falló": el mensaje genérico de
          // credenciales confundiría a quien sí tiene cuenta de Google válida.
          setError(
            axios.isAxiosError(err) && err.response?.status === 401
              ? t('login.googleNoAutorizado')
              : t('login.errorServidor'),
          )
        })
        .finally(() => setCargando(false))
    }).catch(() => {
      if (vigente) setAvisoOAuth(t('login.googleNoDisponible'))
    })

    return () => {
      vigente = false
    }
  }, [loginConGoogle, navigate, t])

  const entrarDemo = async (emailDemo: string) => {
    setError(null)
    setAvisoOAuth(null)
    setCargando(true)
    try {
      await login(emailDemo, 'demo-2026')
      void navigate('/dashboard', { replace: true })
    } catch {
      setError(t('login.errorServidor'))
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="flex min-h-dvh">
      {/* ── Panel de marca ──────────────────────────────────── */}
      <div className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-gradient-to-b from-pine-700 via-pine-800 to-pine-900 p-10 text-cream-100 lg:flex">
        {/* Isotermas: se trazan solas al cargar */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.14]"
          viewBox="0 0 600 800"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden
        >
          {Array.from({ length: 9 }, (_, i) => (
            <path
              key={i}
              className="isoterma"
              style={{ animationDelay: `${i * 90}ms` }}
              d={`M-50 ${90 + i * 85} C 150 ${40 + i * 85}, 300 ${150 + i * 85}, 650 ${80 + i * 85}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            />
          ))}
        </svg>
        {/* Marca de agua editorial: el rango que lo rige todo */}
        <p
          className="pointer-events-none absolute -bottom-10 -right-4 select-none font-display text-[190px] font-semibold italic leading-none tracking-tighter text-cream-100/[0.05]"
          aria-hidden
        >
          2–8°
        </p>

        <div className="relative animate-fade">
          <ColdCareBrand variant="stacked" subtitulo={t('app.subtitulo')} tone="light" />
        </div>

        <div className="relative max-w-md">
          <p
            className="font-display text-[56px] font-semibold italic leading-[1.02] tracking-tight text-balance animate-rise-lg"
            style={{ animationDelay: '150ms' }}
          >
            {t('login.eslogan')}
          </p>
          <p
            className="mt-6 text-[15px] leading-relaxed text-cream-100/80 animate-rise-lg"
            style={{ animationDelay: '300ms' }}
          >
            {t('login.descripcion')}
          </p>
        </div>

        <div
          className="relative flex items-center gap-5 text-xs text-cream-100/75 animate-rise-lg"
          style={{ animationDelay: '450ms' }}
        >
          <span className="inline-flex items-center gap-1.5">
            <ThermometerSnowflake className="size-3.5" />
            {t('login.rango')}
          </span>
          <span className="h-3 w-px bg-cream-100/25" aria-hidden />
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="size-3.5" />
            {t('login.notaSeguridad')}
          </span>
        </div>
      </div>

      {/* ── Formulario ──────────────────────────────────────── */}
      <div className="relative flex flex-1 items-center justify-center px-6 py-12">
        <div className="absolute right-6 top-6 animate-fade" style={{ animationDelay: '200ms' }}>
          <LanguageSwitcher />
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8 mt-8 animate-rise lg:hidden">
            <ColdCareBrand variant="compact" />
          </div>

          <div className="animate-rise">
            <p className="eyebrow mb-2 text-pine-600">{t('app.subtitulo')}</p>
            <h1 className="font-display text-[28px] leading-[34px] font-bold tracking-tight">
              {t('login.titulo')}
            </h1>
            <p className="mt-1.5 text-sm text-muted">{t('login.subtitulo')}</p>
          </div>

          {motivoAviso && (
            <p
              role="status"
              className="mt-5 flex items-start gap-2 rounded-(--radius-field) border border-pine-200 bg-pine-100/70 px-3 py-2 text-[13px] leading-snug text-pine-700 animate-rise"
            >
              <Info className="mt-0.5 size-3.5 shrink-0" />
              {motivoAviso === 'expirada'
                ? t('comunes.sesionExpirada')
                : t('login.sesionCerradaRecarga')}
            </p>
          )}

          <form
            onSubmit={enviar}
            className="mt-8 space-y-4 animate-rise"
            style={{ animationDelay: '90ms' }}
            noValidate
          >
            <div>
              <Label htmlFor="email">{t('login.email')}</Label>
              <Input
                ref={emailRef}
                id="email"
                type="email"
                autoComplete="email"
                required
                maxLength={120}
                value={email}
                aria-invalid={Boolean(errorEmail)}
                aria-describedby={errorEmail ? 'email-error' : undefined}
                className={errorEmail ? 'border-clay-600 focus:border-clay-600 focus:ring-clay-600/20' : undefined}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setErrorEmail(null)
                }}
                placeholder="farmacia@ejemplo.com"
              />
              {errorEmail && (
                <p id="email-error" role="alert" className="mt-1.5 text-sm text-clay-700">
                  {errorEmail}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="password">{t('login.password')}</Label>
              <Input
                ref={passwordRef}
                id="password"
                type="password"
                autoComplete="current-password"
                required
                minLength={8}
                maxLength={128}
                value={password}
                aria-invalid={Boolean(errorPassword)}
                aria-describedby={errorPassword ? 'password-error' : undefined}
                className={errorPassword ? 'border-clay-600 focus:border-clay-600 focus:ring-clay-600/20' : undefined}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setErrorPassword(null)
                }}
                placeholder="••••••••"
              />
              {errorPassword && (
                <p id="password-error" role="alert" className="mt-1.5 text-sm text-clay-700">
                  {errorPassword}
                </p>
              )}
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-(--radius-field) border border-clay-600/20 bg-clay-100 px-3 py-2 text-[13px] text-clay-700 animate-rise"
              >
                {error}
              </p>
            )}
            {avisoOAuth && (
              <p
                role="status"
                className="rounded-(--radius-field) border border-honey-600/20 bg-honey-100 px-3 py-2 text-[13px] text-honey-700 animate-rise"
              >
                {avisoOAuth}
              </p>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={cargando}>
              {cargando ? t('login.entrando') : t('login.entrar')}
            </Button>
          </form>

          {MODO_DEMO && (
            <div
              className="mt-6 rounded-(--radius-card) border border-glacier-200 bg-secondary-tint/70 p-4 animate-rise"
              style={{ animationDelay: '140ms' }}
            >
              <p className="eyebrow mb-1 flex items-center gap-1.5 text-glacier-700">
                <FlaskConical className="size-3" />
                {t('demo.accesoRapido')}
              </p>
              <p className="mb-3 text-[13px] leading-snug text-muted">{t('demo.accesoDetalle')}</p>
              <div className="flex flex-wrap gap-2">
                {CUENTAS_DEMO.map(({ rol, email: emailDemo }) => (
                  <button
                    key={rol}
                    type="button"
                    disabled={cargando}
                    onClick={() => void entrarDemo(emailDemo)}
                    className="min-h-11 cursor-pointer rounded-full border border-primary/20 bg-surface px-3.5 py-1.5 text-xs font-semibold text-ink-700 shadow-sm transition-[transform,background-color,box-shadow] duration-150 hover:-translate-y-px hover:bg-primary-tint hover:shadow-md disabled:pointer-events-none disabled:opacity-50"
                  >
                    {t(`roles.${rol}`)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div
            className="my-6 flex items-center gap-3 text-xs text-faint animate-rise"
            style={{ animationDelay: '180ms' }}
          >
            <span className="h-px flex-1 bg-border" />
            {t('login.oContinuaCon')}
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="space-y-2.5 animate-rise" style={{ animationDelay: '260ms' }}>
            {GOOGLE_HABILITADO ? (
              // Contenedor del botón que renderiza Google. Se usa el suyo y no
              // uno propio porque su política de marca lo exige y porque el
              // flujo de credenciales queda dentro de su iframe.
              <div ref={contenedorGoogle} data-testid="boton-google" className="min-h-11" />
            ) : (
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => oauthPendiente('Google')}
              >
                <GoogleIcon />
                {t('login.google')}
              </Button>
            )}
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => oauthPendiente('Facebook')}
            >
              <FacebookIcon />
              {t('login.facebook')}
            </Button>
          </div>

          <p
            className="mt-8 flex items-center justify-center gap-1.5 text-center text-[11px] text-faint animate-fade lg:hidden"
            style={{ animationDelay: '350ms' }}
          >
            <ShieldCheck className="size-3" />
            {t('login.notaSeguridad')}
          </p>
        </div>
      </div>
    </div>
  )
}
