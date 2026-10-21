import { useCallback, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react'

import { useAuthStore } from '@/application/stores/authStore'
import { consumirMotivoAviso } from '@/infrastructure/auth/avisoSesion'
import { MODO_DEMO } from '@/infrastructure/demo/modoDemo'
import { AuthShell } from '@/presentation/components/auth/AuthShell'
import { ColdCareBrandPanel } from '@/presentation/components/auth/ColdCareBrandPanel'
import { DemoRoleGrid } from '@/presentation/components/auth/DemoRoleGrid'
import { GoogleAuthSection } from '@/presentation/components/auth/GoogleAuthSection'
import { submitButtonMotion } from '@/presentation/components/auth/loginMotion'
import { Input } from '@/presentation/components/ui/input'

/** Credential and demo access share the light ColdCare account workspace. */
export function LoginPage() {
  const { t, i18n } = useTranslation()
  const en = i18n.language.startsWith('en')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  // El motivo llega por `?sesion=` o, al expirar/recargar, por las marcas de
  // sessionStorage (avisoSesion.ts). Se consume una sola vez al montar.
  const [avisoSesion] = useState(() => searchParams.get('sesion') ?? consumirMotivoAviso())
  const shouldReduceMotion = useReducedMotion()

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
      void navigate('/dashboard', { replace: true })
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
    void navigate('/dashboard', { replace: true })
  }, [navigate])

  return (
    <AuthShell brandPanel={<ColdCareBrandPanel />}>
      <div className="w-full">
        {/* Cabecera del formulario */}
        <div className="mb-5">
          <h2 className="text-[28px] leading-[34px] font-bold tracking-tight text-foreground sm:text-[32px] sm:leading-10">
            {t('login.titulo', { defaultValue: 'Iniciar sesión' })}
          </h2>
          <p className="mt-2 text-base leading-6 text-muted">
            {t('login.subtitulo', { defaultValue: 'Ingresa con tu cuenta autorizada.' })}
          </p>
        </div>

        {/* Notificación de sesión expirada o recarga de página (HU-40) */}
        {avisoSesion && (
          <p
            role="status"
            className="mb-4 rounded-xl border border-primary/20 bg-primary-tint px-3.5 py-2.5 text-xs sm:text-sm text-foreground"
          >
            {avisoSesion === 'expirada'
              ? t('sesion.sesionExpirada')
              : t('login.sesionCerradaRecarga')}
          </p>
        )}

        {/* Formulario de credenciales con iconos integrados */}
        <form className="space-y-3.5" onSubmit={enviar} noValidate>
          {/* Campo Correo Electrónico con icono Mail */}
          <div className="space-y-1.5">
            <label htmlFor="login-email" className="block text-sm font-medium text-ink-700">
              {t('login.email', { defaultValue: 'Correo electrónico' })}
            </label>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint"
                aria-hidden="true"
              />
              <Input
                ref={emailRef}
                id="login-email"
                type="email"
                autoComplete="username"
                placeholder="farmacia@ejemplo.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={Boolean(
                  error && (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())),
                )}
                className="h-11 sm:h-12 pl-10 text-foreground placeholder:text-faint focus-visible:border-primary focus-visible:ring-primary/20 text-base sm:text-sm"
                required
              />
            </div>
          </div>

          {/* Campo Contraseña con icono Lock y toggle de visibilidad */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="login-password" className="block text-sm font-medium text-ink-700">
                {t('login.password', { defaultValue: 'Contraseña' })}
              </label>
              <Link
                to="/recuperar-contrasena"
                className="text-xs font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary rounded-sm"
              >
                {t('login.olvidastePassword', { defaultValue: '¿Olvidaste tu contraseña?' })}
              </Link>
            </div>
            <div className="relative">
              <Lock
                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint"
                aria-hidden="true"
              />
              <Input
                ref={passwordRef}
                id="login-password"
                type={mostrarPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                className="h-11 sm:h-12 pl-10 pr-12 text-foreground placeholder:text-faint focus-visible:border-primary focus-visible:ring-primary/20 text-base sm:text-sm"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button
                type="button"
                className="absolute right-0.5 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-lg text-faint hover:bg-background hover:text-ink-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary cursor-pointer transition-colors"
                aria-label={t(
                  mostrarPassword ? 'login.ocultarPassword' : 'login.mostrarPassword',
                  { defaultValue: mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña' }
                )}
                onClick={() => setMostrarPassword((visible) => !visible)}
              >
                {mostrarPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-critical/20 bg-critical-tint px-3.5 py-2.5 text-xs sm:text-sm text-critical animate-fade"
            >
              {error}
            </p>
          )}

          {/* Botón principal azul con flecha derecha */}
          <motion.button
            type="submit"
            disabled={cargando}
            whileHover={shouldReduceMotion ? undefined : submitButtonMotion.whileHover}
            whileTap={shouldReduceMotion ? undefined : submitButtonMotion.whileTap}
            className="flex h-11 sm:h-12 w-full items-center justify-center gap-2 rounded-xl coldcare-primary-action px-4 text-sm font-semibold text-white shadow-(--shadow-card) transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60 cursor-pointer"
          >
            {cargando ? (
              <>
                <Loader2 className="size-4 animate-spin text-white" aria-hidden />
                <span>{t('login.entrando', { defaultValue: 'Ingresando…' })}</span>
              </>
            ) : (
              <>
                <span>{t('login.entrar', { defaultValue: 'Ingresar' })}</span>
                <ArrowRight className="size-4" aria-hidden="true" />
              </>
            )}
          </motion.button>

          {/* FE-001: Google real (ID token verificado por el backend); sin
              VITE_GOOGLE_CLIENT_ID no se muestra. */}
          <GoogleAuthSection onIdToken={loginConGoogle} onExito={irAlPanel} />

          {/* Enlace solicitar acceso */}
          <div className="pt-1.5 text-center text-xs text-muted">
            <span>{t('login.sinAcceso', { defaultValue: '¿Aún no tienes acceso?' })}{' '}</span>
            <Link
              to="/solicitar-acceso"
              className="font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary rounded-sm"
            >
              {t('login.solicitarAcceso', { defaultValue: 'Solicitar acceso' })}
            </Link>
          </div>
        </form>

        <p className="mt-4 flex flex-wrap items-center justify-center gap-x-1 text-sm text-muted">
          {en ? 'New to ColdCare?' : '¿Primera vez en ColdCare?'}
          <Link to="/registro" className="inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline">{en ? 'Create account' : 'Crear cuenta'}</Link>
        </p>

        {/* Demo roles stay in view; users should not have to discover a hidden menu. */}
        {mostrarDemo && (
          <DemoRoleGrid
            onSelectRole={entrarDemo}
            cargandoGeneral={cargando}
            className="mt-5 border-t border-border pt-4"
          />
        )}
      </div>
    </AuthShell>
  )
}
