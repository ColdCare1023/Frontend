import { useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import { Loader2, ShieldAlert } from 'lucide-react'

import { useAuthStore } from '@/application/stores/authStore'
import { AuthShell } from '../components/auth/AuthShell'
import { CamposPasswordNueva } from '../components/auth/CamposPasswordNueva'
import { errorPasswordNueva } from '../components/auth/errorPasswordNueva'
import { ColdCareBrandPanel } from '../components/auth/ColdCareBrandPanel'
import { Input, Label } from '../components/ui/input'

/**
 * FE-004: cambio de contraseña (BE-025). Obligatorio con una contraseña
 * temporal asignada por un administrador; voluntario en cualquier otro
 * momento. El backend invalida las sesiones previas y devuelve un token nuevo.
 */
export function CambiarPasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const obligatorio = useAuthStore((s) => s.requiereCambioPassword)
  const cambiarPassword = useAuthStore((s) => s.cambiarPassword)
  const logout = useAuthStore((s) => s.logout)
  const passwordRef = useRef<HTMLInputElement>(null)
  const [actual, setActual] = useState('')
  const [password, setPassword] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const enviar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!actual) {
      setError(t('cambiarPassword.errorActualVacia'))
      return
    }
    const problema = errorPasswordNueva(t, password, confirmacion)
    if (problema) {
      setError(problema)
      passwordRef.current?.focus()
      return
    }
    setError(null)
    setCargando(true)
    try {
      await cambiarPassword(actual, password)
      void navigate('/dashboard', { replace: true })
    } catch (err) {
      const estado = axios.isAxiosError(err) ? err.response?.status : undefined
      const detalle = axios.isAxiosError(err) ? String(err.response?.data?.detail ?? '') : ''
      setError(
        estado === 400 && detalle.includes('distinta')
          ? t('cambiarPassword.errorIgual')
          : estado === 400
            ? t('cambiarPassword.errorActual')
            : estado === 422
              ? t('restablecerContrasena.politica.sin_letras_y_digitos')
              : estado === 429
                ? t('login.errorDemasiadosIntentos')
                : t('login.errorServidor'),
      )
    } finally {
      setCargando(false)
    }
  }

  return (
    <AuthShell brandPanel={<ColdCareBrandPanel />}>
      <div className="flex flex-col">
        <div className="mb-6">
          <h2 className="text-[28px] leading-[34px] font-bold tracking-tight text-foreground sm:text-[32px] sm:leading-10">
            {t('cambiarPassword.titulo')}
          </h2>
          <p className="mt-2 text-base leading-6 text-muted">{t('cambiarPassword.subtitulo')}</p>
        </div>

        {obligatorio && (
          <p role="status" className="mb-4 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{t('cambiarPassword.temporal')}</span>
          </p>
        )}

        <form onSubmit={(e) => void enviar(e)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="password-actual">{t('cambiarPassword.actual')}</Label>
            <Input
              id="password-actual"
              type="password"
              autoComplete="current-password"
              value={actual}
              onChange={(e) => setActual(e.target.value)}
              required
            />
          </div>
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
              <span>{t('cambiarPassword.boton')}</span>
            )}
          </button>
        </form>

        <div className="pt-6 text-center text-xs text-muted">
          {obligatorio ? (
            <button
              type="button"
              onClick={() => {
                logout()
                void navigate('/login', { replace: true })
              }}
              className="font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary rounded-sm cursor-pointer"
            >
              {t('cambiarPassword.salir')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void navigate(-1)}
              className="font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary rounded-sm cursor-pointer"
            >
              {t('usuarios.cancelar')}
            </button>
          )}
        </div>
      </div>
    </AuthShell>
  )
}
