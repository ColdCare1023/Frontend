import { useState, useEffect, useRef, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, XCircle } from 'lucide-react'

import { mockPasswordRecoveryService } from '@/infrastructure/auth/MockPasswordRecoveryService'
import { AuthShell } from '../components/auth/AuthShell'
import { ColdCareBrandPanel } from '../components/auth/ColdCareBrandPanel'
import { Input, Label } from '../components/ui/input'

export function RestablecerContrasenaPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || 'demo-recovery-token'

  const passwordRef = useRef<HTMLInputElement>(null)
  const [password, setPassword] = useState('')
  const [confirmarPassword, setConfirmarPassword] = useState('')
  const [mostrarPassword, setMostrarPassword] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [validandoToken, setValidandoToken] = useState(true)
  const [tokenValido, setTokenValido] = useState(true)
  const [emailAsociado, setEmailAsociado] = useState<string | null>(null)
  const [exito, setExito] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    const verificar = async () => {
      setValidandoToken(true)
      const res = await mockPasswordRecoveryService.validarToken(token)
      if (!cancelado) {
        setTokenValido(res.valido)
        if (res.email) setEmailAsociado(res.email)
        setValidandoToken(false)
      }
    }
    void verificar()
    return () => {
      cancelado = true
    }
  }, [token])

  const manejarSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError(t('restablecerContrasena.errorLongitud'))
      passwordRef.current?.focus()
      return
    }

    if (password !== confirmarPassword) {
      setError(t('restablecerContrasena.errorCoincidencia'))
      return
    }

    setCargando(true)
    try {
      const res = await mockPasswordRecoveryService.restablecerContrasena(token, password)
      if (res.success) {
        setExito(true)
      } else {
        setError(
          res.error === 'token_invalido'
            ? t('restablecerContrasena.tokenInvalido')
            : t('restablecerContrasena.errorLongitud'),
        )
      }
    } catch {
      setError(t('login.errorServidor'))
    } finally {
      setCargando(false)
    }
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
                {t('restablecerContrasena.titulo')}
              </h2>
              <p className="mt-2 text-base leading-6 text-muted">
                {emailAsociado
                  ? `${t('restablecerContrasena.subtitulo')} (${emailAsociado})`
                  : t('restablecerContrasena.subtitulo')}
              </p>
          </div>

          {validandoToken ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
              <p className="text-sm text-muted">{t('app.cargando')}</p>
            </div>
          ) : !tokenValido ? (
            /* Estado de token inválido o expirado */
            <div className="space-y-6 animate-fade">
              <div className="rounded-2xl border border-clay-700/20 bg-clay-100/50 p-6">
                <div className="flex items-start gap-3.5">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-clay-700 text-white shadow-sm">
                    <XCircle className="size-5" aria-hidden />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-base font-bold text-foreground">
                      {t('restablecerContrasena.tokenInvalido')}
                    </h3>
                    <p className="text-sm text-muted leading-relaxed">
                      El enlace de seguridad caducó o ya fue utilizado anteriormente. Solicita un nuevo enlace para continuar.
                    </p>
                  </div>
                </div>
              </div>

              <Link
                to="/recuperar-contrasena"
                className="flex h-11 w-full items-center justify-center rounded-xl coldcare-primary-action px-4 text-sm font-semibold text-white shadow-(--shadow-card) hover:shadow-(--shadow-card) transition-all"
              >
                {t('restablecerContrasena.solicitarNuevo')}
              </Link>
            </div>
          ) : exito ? (
            /* Estado de éxito */
            <div className="space-y-6 animate-fade">
              <div className="rounded-2xl border border-border bg-secondary-tint/60 p-5">
                <div className="flex items-start gap-3.5">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary-tint text-glacier-700">
                    <CheckCircle2 className="size-5" aria-hidden />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-base font-bold text-foreground">
                      {t('restablecerContrasena.exitoTitulo')}
                    </h3>
                    <p className="text-sm text-muted leading-relaxed">
                      {t('restablecerContrasena.exitoMensaje')}
                    </p>
                  </div>
                </div>
              </div>

              <Link
                to="/login"
                className="flex h-11 w-full items-center justify-center rounded-xl coldcare-primary-action px-4 text-sm font-semibold text-white shadow-(--shadow-card) hover:shadow-(--shadow-card) transition-all"
              >
                {t('restablecerContrasena.irLogin')}
              </Link>
            </div>
          ) : (
            /* Formulario para ingresar nueva contraseña */
            <form onSubmit={manejarSubmit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="nueva-password">{t('restablecerContrasena.passwordNueva')}</Label>
                <div className="relative">
                  <Input
                    ref={passwordRef}
                    id="nueva-password"
                    type={mostrarPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    className="pr-12"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-0.5 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-md text-muted hover:bg-cream-100 focus-visible:outline-2 focus-visible:outline-primary cursor-pointer"
                    aria-label={t(
                      mostrarPassword ? 'login.ocultarPassword' : 'login.mostrarPassword',
                    )}
                    onClick={() => setMostrarPassword((v) => !v)}
                  >
                    {mostrarPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmar-password">
                  {t('restablecerContrasena.passwordConfirmacion')}
                </Label>
                <Input
                  id="confirmar-password"
                  type={mostrarPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmarPassword}
                  onChange={(e) => setConfirmarPassword(e.target.value)}
                  required
                />
              </div>

              <p className="text-xs text-muted flex items-center gap-1.5">
                <KeyRound className="size-3.5 shrink-0 text-faint" aria-hidden />
                <span>{t('restablecerContrasena.requisitos')}</span>
              </p>

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
                    <span>{t('restablecerContrasena.actualizando')}</span>
                  </>
                ) : (
                  <span>{t('restablecerContrasena.boton')}</span>
                )}
              </button>
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
