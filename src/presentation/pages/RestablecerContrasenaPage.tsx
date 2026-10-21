import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, CheckCircle2, Loader2, XCircle } from 'lucide-react'

import { consumirTokenDelEnlace, restablecerPassword } from '@/infrastructure/auth/credencialesService'
import { AuthShell } from '../components/auth/AuthShell'
import { CamposPasswordNueva } from '../components/auth/CamposPasswordNueva'
import { errorPasswordNueva } from '../components/auth/errorPasswordNueva'
import { ColdCareBrandPanel } from '../components/auth/ColdCareBrandPanel'

/**
 * FE-004: restablecimiento con el enlace de un solo uso que envía el backend
 * (BE-025). Sin token no hay formulario: nunca existe un valor por defecto.
 * El token se lee del fragmento y se borra de la URL al montar.
 */
export function RestablecerContrasenaPage() {
  const { t } = useTranslation()
  const [token] = useState(consumirTokenDelEnlace)
  const passwordRef = useRef<HTMLInputElement>(null)
  const [password, setPassword] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [cargando, setCargando] = useState(false)
  const [enlaceInvalido, setEnlaceInvalido] = useState(token === null)
  const [exito, setExito] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const enviar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const problema = errorPasswordNueva(t, password, confirmacion)
    if (problema) {
      setError(problema)
      passwordRef.current?.focus()
      return
    }
    if (!token) return
    setError(null)
    setCargando(true)
    const resultado = await restablecerPassword(token, password)
    setCargando(false)
    if (resultado === 'ok') setExito(true)
    else if (resultado === 'enlace_invalido') setEnlaceInvalido(true)
    else if (resultado === 'password_invalida') setError(t('restablecerContrasena.politica.sin_letras_y_digitos'))
    else if (resultado === 'limite') setError(t('login.errorDemasiadosIntentos'))
    else setError(t('login.errorServidor'))
  }

  return (
    <AuthShell brandPanel={<ColdCareBrandPanel />}>
      <div className="flex flex-col">
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
          <p className="mt-2 text-base leading-6 text-muted">{t('restablecerContrasena.subtitulo')}</p>
        </div>

        {enlaceInvalido ? (
          <div className="space-y-6 animate-fade">
            <div role="alert" className="rounded-2xl border border-clay-700/20 bg-clay-100/50 p-6">
              <div className="flex items-start gap-3.5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-clay-700 text-white shadow-sm">
                  <XCircle className="size-5" aria-hidden />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-foreground">{t('restablecerContrasena.tokenInvalido')}</h3>
                  <p className="text-sm leading-relaxed text-muted">{t('restablecerContrasena.tokenInvalidoDetalle')}</p>
                </div>
              </div>
            </div>
            <Link
              to="/recuperar-contrasena"
              className="flex h-11 w-full items-center justify-center rounded-xl coldcare-primary-action px-4 text-sm font-semibold text-white shadow-(--shadow-card) transition-all"
            >
              {t('restablecerContrasena.solicitarNuevo')}
            </Link>
          </div>
        ) : exito ? (
          <div className="space-y-6 animate-fade">
            <div role="status" className="rounded-2xl border border-border bg-secondary-tint/60 p-5">
              <div className="flex items-start gap-3.5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary-tint text-glacier-700">
                  <CheckCircle2 className="size-5" aria-hidden />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-foreground">{t('restablecerContrasena.exitoTitulo')}</h3>
                  <p className="text-sm leading-relaxed text-muted">{t('restablecerContrasena.exitoMensaje')}</p>
                </div>
              </div>
            </div>
            <Link
              to="/login"
              className="flex h-11 w-full items-center justify-center rounded-xl coldcare-primary-action px-4 text-sm font-semibold text-white shadow-(--shadow-card) transition-all"
            >
              {t('restablecerContrasena.irLogin')}
            </Link>
          </div>
        ) : (
          <form onSubmit={(e) => void enviar(e)} className="space-y-4" noValidate>
            <CamposPasswordNueva
              password={password}
              confirmacion={confirmacion}
              onPassword={setPassword}
              onConfirmacion={setConfirmacion}
              passwordRef={passwordRef}
            />
            {error && (
              <p role="alert" className="rounded-xl border border-clay-100 bg-clay-100/60 px-3.5 py-2.5 text-sm text-clay-700 animate-fade">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={cargando}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl coldcare-primary-action px-4 text-sm font-semibold text-white shadow-(--shadow-card) transition-all duration-200 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60 cursor-pointer"
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
    </AuthShell>
  )
}
