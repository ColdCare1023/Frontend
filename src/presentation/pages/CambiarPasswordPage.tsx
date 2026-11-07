import { useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import axios from 'axios'

import { useAuthStore } from '@/application/stores/authStore'
import { cn } from '@/lib/utils'
import { AuthShell } from '../components/auth/AuthShell'
import { CamposPasswordNueva } from '../components/auth/CamposPasswordNueva'
import { CAMPO_ACCESO, ENLACE_ACCESO } from '../components/auth/clasesAcceso'
import { errorPasswordNueva } from '../components/auth/errorPasswordNueva'
import { ColdCareBrandPanel } from '../components/auth/ColdCareBrandPanel'
import { AvisoAcceso, BotonAcceso, EncabezadoAcceso, type ErrorAcceso } from '../components/auth/PiezasAcceso'
import { Input, Label } from '../components/ui/input'

const ID_ERROR = 'cambiar-error'

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
  const actualRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const [actual, setActual] = useState('')
  const [password, setPassword] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [cargando, setCargando] = useState(false)
  // `campo`: qué campo explica el aviso; sin él, el problema está en el servidor.
  const [error, setError] = useState<(ErrorAcceso & { campo?: 'actual' | 'nueva' }) | null>(null)

  const enviar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!actual) {
      setError({ texto: t('cambiarPassword.errorActualVacia'), tono: 'error', campo: 'actual' })
      actualRef.current?.focus()
      return
    }
    const problema = errorPasswordNueva(t, password, confirmacion)
    if (problema) {
      setError({ texto: problema, tono: 'error', campo: 'nueva' })
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
      if (estado === 429) {
        setError({ texto: t('login.errorDemasiadosIntentos'), tono: 'bloqueo' })
      } else {
        const igual = estado === 400 && detalle.includes('distinta')
        setError({
          texto: igual
            ? t('cambiarPassword.errorIgual')
            : estado === 400
              ? t('cambiarPassword.errorActual')
              : estado === 422
                ? t('restablecerContrasena.politica.sin_letras_y_digitos')
                : t('login.errorServidor'),
          tono: 'error',
          campo: igual || estado === 422 ? 'nueva' : estado === 400 ? 'actual' : undefined,
        })
      }
    } finally {
      setCargando(false)
    }
  }

  return (
    <AuthShell brandPanel={<ColdCareBrandPanel />}>
      <EncabezadoAcceso titulo={t('cambiarPassword.titulo')} bajada={t('cambiarPassword.subtitulo')} />

      {obligatorio && (
        <AvisoAcceso tono="preventivo" className="mb-4 lg:mb-6">
          {t('cambiarPassword.temporal')}
        </AvisoAcceso>
      )}

      <form onSubmit={(e) => void enviar(e)} className="acceso-formulario" aria-busy={cargando} noValidate>
        <div>
          <Label htmlFor="password-actual">{t('cambiarPassword.actual')}</Label>
          <Input
            ref={actualRef}
            id="password-actual"
            type="password"
            autoComplete="current-password"
            className={CAMPO_ACCESO}
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            aria-invalid={error?.campo === 'actual'}
            aria-describedby={error?.campo === 'actual' ? ID_ERROR : undefined}
            required
          />
        </div>
        <CamposPasswordNueva
          password={password}
          confirmacion={confirmacion}
          onPassword={setPassword}
          onConfirmacion={setConfirmacion}
          passwordRef={passwordRef}
          errorId={error?.campo === 'nueva' ? ID_ERROR : undefined}
        />
        {error && (
          <AvisoAcceso id={ID_ERROR} tono={error.tono}>
            {error.texto}
          </AvisoAcceso>
        )}
        <BotonAcceso cargando={cargando} textoCargando={t('restablecerContrasena.actualizando')}>
          {t('cambiarPassword.boton')}
        </BotonAcceso>
      </form>

      {obligatorio ? (
        <button
          type="button"
          onClick={() => {
            logout()
            void navigate('/login', { replace: true })
          }}
          className={cn(ENLACE_ACCESO, 'mt-2 lg:mt-3')}
        >
          {t('cambiarPassword.salir')}
        </button>
      ) : (
        <button type="button" onClick={() => void navigate(-1)} className={cn(ENLACE_ACCESO, 'mt-2 lg:mt-3')}>
          {t('usuarios.cancelar')}
        </button>
      )}
    </AuthShell>
  )
}
