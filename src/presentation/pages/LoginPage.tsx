import { useCallback, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ArrowRight, CircleAlert, Eye, EyeOff, Info, Loader2, Lock, Mail } from 'lucide-react'

import { useAuthStore } from '@/application/stores/authStore'
import { consumirMotivoAviso } from '@/infrastructure/auth/avisoSesion'
import { MODO_DEMO } from '@/infrastructure/demo/modoDemo'
import { AuthShell } from '@/presentation/components/auth/AuthShell'
import { ColdCareBrandPanel } from '@/presentation/components/auth/ColdCareBrandPanel'
import { DemoRoleGrid } from '@/presentation/components/auth/DemoRoleGrid'
import { GoogleAuthSection } from '@/presentation/components/auth/GoogleAuthSection'
import { Input } from '@/presentation/components/ui/input'

/** Credential and demo access share the light ColdCare account workspace. */
export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  // El motivo llega por `?sesion=` o, al expirar/recargar, por las marcas de
  // sessionStorage (avisoSesion.ts). Se consume una sola vez al montar.
  const [avisoSesion] = useState(() => searchParams.get('sesion') ?? consumirMotivoAviso())

  const login = useAuthStore((state) => state.login)
  const loginConGoogle = useAuthStore((state) => state.loginConGoogle)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [mostrarPassword, setMostrarPassword] = useState(false)

  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  const mostrarDemo = MODO_DEMO

  const autenticar = async (correo: string, clave: string) => {
    setError(null)
    setCargando(true)
    try {
      await login(correo, clave)
      // FE-004: con una contraseña temporal solo se puede cambiarla.
      const destino = useAuthStore.getState().requiereCambioPassword ? '/cambiar-password' : '/dashboard'
      void navigate(destino, { replace: true })
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { detail?: string } } }
      if (e?.response?.status === 429) {
        setError(t('login.errorDemasiadosIntentos'))
      } else if (e?.response?.status === 401) {
        setError(t('login.errorCredenciales'))
      } else {
        setError(t('login.errorCredenciales'))
      }
    } finally {
      setCargando(false)
    }
  }

  const enviar = async (event: FormEvent) => {
    event.preventDefault()
    if (!email.trim()) {
      setError(t('login.errorEmailVacio'))
      emailRef.current?.focus()
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(t('login.errorEmailInvalido'))
      emailRef.current?.focus()
      return
    }
    if (!password) {
      setError(t('login.errorPasswordVacia'))
      passwordRef.current?.focus()
      return
    }
    await autenticar(email.trim(), password)
  }

  const entrarDemo = (correo: string) => autenticar(correo, 'demo-2026')

  const irAlPanel = useCallback(() => {
    const destino = useAuthStore.getState().requiereCambioPassword ? '/cambiar-password' : '/dashboard'
    void navigate(destino, { replace: true })
  }, [navigate])

  return (
    <AuthShell brandPanel={<ColdCareBrandPanel />}>
      <div className="w-full">
        <div className="mb-7">
          <h2 className="text-[26px] leading-8 font-semibold tracking-tight text-foreground">
            {t('login.titulo')}
          </h2>
          <p className="mt-1.5 text-[15px] leading-6 text-muted">{t('login.subtitulo')}</p>
        </div>

        {/* Notificación de sesión expirada o recarga de página (HU-40) */}
        {avisoSesion && (
          <p
            role="status"
            className="mb-5 flex items-start gap-2.5 rounded-(--radius-field) bg-primary-tint px-3 py-2.5 text-sm leading-5 text-foreground ring-1 ring-inset ring-primary/20"
          >
            <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            {avisoSesion === 'expirada' ? t('comunes.sesionExpirada') : t('login.sesionCerradaRecarga')}
          </p>
        )}

        <form className="space-y-4" onSubmit={enviar} noValidate>
          <div className="space-y-1.5">
            <label htmlFor="login-email" className="block text-[13px] leading-5 font-medium text-ink-700">
              {t('login.email')}
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden="true" />
              <Input
                ref={emailRef}
                id="login-email"
                type="email"
                autoComplete="username"
                placeholder={t('login.emailPlaceholder')}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={Boolean(
                  error && (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())),
                )}
                className="h-11 pl-10 pointer-coarse:h-12"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="login-password" className="block text-[13px] leading-5 font-medium text-ink-700">
                {t('login.password')}
              </label>
              <Link
                to="/recuperar-contrasena"
                className="rounded-sm text-[13px] font-medium text-primary transition-colors hover:text-primary-hover hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
              >
                {t('login.olvidastePassword')}
              </Link>
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden="true" />
              <Input
                ref={passwordRef}
                id="login-password"
                type={mostrarPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                className="h-11 pl-10 pr-12 pointer-coarse:h-12"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button
                type="button"
                className="absolute right-0 top-1/2 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-faint transition-colors hover:bg-cream-200/70 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring sm:right-1 sm:size-9 sm:pointer-coarse:size-10"
                aria-label={t(mostrarPassword ? 'login.ocultarPassword' : 'login.mostrarPassword')}
                aria-pressed={mostrarPassword}
                onClick={() => setMostrarPassword((visible) => !visible)}
              >
                {mostrarPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="flex items-start gap-2.5 rounded-(--radius-field) bg-critical-tint px-3 py-2.5 text-sm leading-5 text-critical ring-1 ring-inset ring-critical/25 animate-fade"
            >
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={cargando}
            className="coldcare-primary-action flex h-11 w-full cursor-pointer items-center justify-center gap-2 px-4 text-sm font-semibold disabled:cursor-wait disabled:opacity-70 pointer-coarse:h-12"
          >
            {cargando ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                <span>{t('login.entrando')}</span>
              </>
            ) : (
              <>
                <span>{t('login.entrar')}</span>
                <ArrowRight className="size-4" aria-hidden="true" />
              </>
            )}
          </button>

          {/* FE-001: Google real (ID token verificado por el backend); sin
              VITE_GOOGLE_CLIENT_ID no se muestra. */}
          <GoogleAuthSection onIdToken={loginConGoogle} onExito={irAlPanel} />

          {/* FE-004: no hay autorregistro; las cuentas las crea el administrador. */}
          <p className="text-center text-xs leading-5 text-faint">{t('login.cuentasAdministrador')}</p>
        </form>

        {/* Demo roles stay in view; users should not have to discover a hidden menu. */}
        {mostrarDemo && (
          <DemoRoleGrid
            onSelectRole={entrarDemo}
            cargandoGeneral={cargando}
            className="mt-7 border-t border-border pt-6"
          />
        )}
      </div>
    </AuthShell>
  )
}
