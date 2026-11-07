import { useCallback, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'

import { useAuthStore } from '@/application/stores/authStore'
import { consumirMotivoAviso } from '@/infrastructure/auth/avisoSesion'
import { MODO_DEMO } from '@/infrastructure/demo/modoDemo'
import { cn } from '@/lib/utils'
import { AuthShell } from '@/presentation/components/auth/AuthShell'
import { CAMPO_ACCESO, ENLACE_ACCESO } from '@/presentation/components/auth/clasesAcceso'
import { ColdCareBrandPanel } from '@/presentation/components/auth/ColdCareBrandPanel'
import { DemoRoleGrid } from '@/presentation/components/auth/DemoRoleGrid'
import { GoogleAuthSection } from '@/presentation/components/auth/GoogleAuthSection'
import {
  AvisoAcceso,
  BotonAcceso,
  BotonVerClave,
  EncabezadoAcceso,
  type ErrorAcceso,
} from '@/presentation/components/auth/PiezasAcceso'
import { Input, Label } from '@/presentation/components/ui/input'

const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ID_ERROR = 'login-error'

/** `credenciales`: el servidor rechazó la pareja, sin decir cuál de los dos campos falló. */
type ErrorLogin = ErrorAcceso & { credenciales?: boolean }

/** Acceso con credenciales y de demostración sobre la foto aprobada. */
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
  const [error, setError] = useState<ErrorLogin | null>(null)
  // De dónde salió la petición en curso: cada origen muestra su propia carga.
  const [enCurso, setEnCurso] = useState<'formulario' | 'demo' | null>(null)
  const [mostrarPassword, setMostrarPassword] = useState(false)

  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  const mostrarDemo = MODO_DEMO

  const autenticar = async (correo: string, clave: string, origen: 'formulario' | 'demo') => {
    setError(null)
    setEnCurso(origen)
    try {
      await login(correo, clave)
      // FE-004: con una contraseña temporal solo se puede cambiarla.
      const destino = useAuthStore.getState().requiereCambioPassword ? '/cambiar-password' : '/dashboard'
      void navigate(destino, { replace: true })
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { detail?: string } } }
      if (e?.response?.status === 429) {
        setError({ texto: t('login.errorDemasiadosIntentos'), tono: 'bloqueo' })
      } else {
        setError({ texto: t('login.errorCredenciales'), tono: 'error', credenciales: true })
      }
    } finally {
      setEnCurso(null)
    }
  }

  const enviar = async (event: FormEvent) => {
    event.preventDefault()
    if (!email.trim()) {
      setError({ texto: t('login.errorEmailVacio'), tono: 'error' })
      emailRef.current?.focus()
      return
    }
    if (!FORMATO_CORREO.test(email.trim())) {
      setError({ texto: t('login.errorEmailInvalido'), tono: 'error' })
      emailRef.current?.focus()
      return
    }
    if (!password) {
      setError({ texto: t('login.errorPasswordVacia'), tono: 'error' })
      passwordRef.current?.focus()
      return
    }
    await autenticar(email.trim(), password, 'formulario')
  }

  const entrarDemo = (correo: string) => autenticar(correo, 'demo-2026', 'demo')

  const irAlPanel = useCallback(() => {
    const destino = useAuthStore.getState().requiereCambioPassword ? '/cambiar-password' : '/dashboard'
    void navigate(destino, { replace: true })
  }, [navigate])

  const correoValido = FORMATO_CORREO.test(email.trim())
  const emailInvalido = Boolean(error && (error.credenciales || !correoValido))
  // La contraseña solo se marca cuando el aviso habla de ella: primero se corrige el correo.
  const passwordInvalida = Boolean(error && (error.credenciales || (correoValido && !password)))

  return (
    <AuthShell brandPanel={<ColdCareBrandPanel />}>
      <EncabezadoAcceso titulo={t('login.titulo')} bajada={t('login.subtitulo')} bajadaSoloEnEscritorio />

      {/* Notificación de sesión expirada o recarga de página (HU-40) */}
      {avisoSesion && (
        <AvisoAcceso tono="info" className="mb-4 lg:mb-6">
          {avisoSesion === 'expirada' ? t('comunes.sesionExpirada') : t('login.sesionCerradaRecarga')}
        </AvisoAcceso>
      )}

      <form className="acceso-formulario" onSubmit={enviar} aria-busy={enCurso === 'formulario'} noValidate>
        <div>
          <Label htmlFor="login-email">{t('login.email')}</Label>
          <Input
            ref={emailRef}
            id="login-email"
            type="email"
            autoComplete="username"
            placeholder={t('login.emailPlaceholder')}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={emailInvalido}
            aria-describedby={emailInvalido ? ID_ERROR : undefined}
            className={CAMPO_ACCESO}
            required
          />
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-3">
            <Label htmlFor="login-password">{t('login.password')}</Label>
            {/* El área táctil crece hacia afuera: el enlace no empuja al campo. */}
            <Link
              to="/recuperar-contrasena"
              className={cn(
                ENLACE_ACCESO,
                'relative min-h-0 text-[13px] leading-5 after:absolute after:-inset-x-1 after:-top-3.5 after:-bottom-1.5',
              )}
            >
              {t('login.olvidastePassword')}
            </Link>
          </div>
          <div className="relative">
            <Input
              ref={passwordRef}
              id="login-password"
              type={mostrarPassword ? 'text' : 'password'}
              autoComplete="current-password"
              className={cn(CAMPO_ACCESO, 'pr-13 sm:pr-13')}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={passwordInvalida}
              aria-describedby={passwordInvalida ? ID_ERROR : undefined}
              required
            />
            <BotonVerClave visible={mostrarPassword} onAlternar={() => setMostrarPassword((visible) => !visible)} />
          </div>
        </div>

        {error && (
          <AvisoAcceso id={ID_ERROR} tono={error.tono}>
            {error.texto}
          </AvisoAcceso>
        )}

        <BotonAcceso
          cargando={enCurso === 'formulario'}
          textoCargando={t('login.entrando')}
          disabled={enCurso === 'demo'}
        >
          {t('login.entrar')}
        </BotonAcceso>

        {/* FE-001: Google real (ID token verificado por el backend); sin
            VITE_GOOGLE_CLIENT_ID no se muestra. */}
        <GoogleAuthSection onIdToken={loginConGoogle} onExito={irAlPanel} />
      </form>

      {/* Los roles de demostración quedan a la vista: nadie debe buscarlos en un menú. */}
      {mostrarDemo && (
        <DemoRoleGrid
          onSelectRole={entrarDemo}
          cargandoGeneral={enCurso === 'formulario'}
          className="acceso-demo"
        />
      )}

      {/* FE-004: no hay autorregistro; las cuentas las crea el administrador. */}
      <p className="acceso-nota">{t('login.cuentasAdministrador')}</p>
    </AuthShell>
  )
}
