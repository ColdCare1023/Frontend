import { useState, useRef, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

import { solicitarRecuperacion } from '@/infrastructure/auth/credencialesService'
import { cn } from '@/lib/utils'
import { AuthShell } from '../components/auth/AuthShell'
import { CAMPO_ACCESO, CTA_ACCESO, ENLACE_ACCESO } from '../components/auth/clasesAcceso'
import { ColdCareBrandPanel } from '../components/auth/ColdCareBrandPanel'
import {
  AvisoAcceso,
  BotonAcceso,
  CampoDesenlace,
  EncabezadoAcceso,
  type ErrorAcceso,
} from '../components/auth/PiezasAcceso'
import { Input, Label } from '../components/ui/input'

const ID_ERROR = 'recuperar-error'

export function RecuperarContrasenaPage() {
  const { t } = useTranslation()
  const emailRef = useRef<HTMLInputElement>(null)
  const [email, setEmail] = useState('')
  const [cargando, setCargando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  // `campo`: el problema está en lo que se escribió, no en el servidor.
  const [error, setError] = useState<(ErrorAcceso & { campo?: boolean }) | null>(null)

  const manejarEnvio = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const normalizado = email.trim()
    if (!normalizado) {
      setError({ texto: t('login.errorEmailVacio'), tono: 'error', campo: true })
      emailRef.current?.focus()
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizado)) {
      setError({ texto: t('login.errorEmailInvalido'), tono: 'error', campo: true })
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
    else if (resultado === 'no_disponible') setError({ texto: t('recuperarContrasena.noDisponible'), tono: 'error' })
    else if (resultado === 'limite') setError({ texto: t('login.errorDemasiadosIntentos'), tono: 'bloqueo' })
    else setError({ texto: t('login.errorServidor'), tono: 'error' })
  }

  // Confirmación: una sola salida principal, sin repetir el regreso arriba.
  if (enviado) {
    return (
      <AuthShell brandPanel={<ColdCareBrandPanel />}>
        <EncabezadoAcceso titulo={t('recuperarContrasena.titulo')} />
        {/* Anti-enumeración: el mensaje es el mismo exista o no la cuenta. */}
        <CampoDesenlace tono="cian" role="status" titulo={t('recuperarContrasena.exitoTitulo')}>
          {t('recuperarContrasena.exitoMensaje', { email })}
        </CampoDesenlace>
        <p className="acceso-nota">{t('recuperarContrasena.notaSeguridad')}</p>
        <Link to="/login" className={cn(CTA_ACCESO, 'mt-5 lg:mt-7')}>
          {t('recuperarContrasena.volverLogin')}
        </Link>
        <button
          type="button"
          onClick={() => {
            setEnviado(false)
            setEmail('')
          }}
          className={cn(ENLACE_ACCESO, 'mt-1 lg:mt-2')}
        >
          {t('recuperarContrasena.enviarOtro')}
        </button>
      </AuthShell>
    )
  }

  return (
    <AuthShell brandPanel={<ColdCareBrandPanel />}>
      <EncabezadoAcceso
        titulo={t('recuperarContrasena.titulo')}
        bajada={t('recuperarContrasena.subtitulo')}
        volver={{ a: '/login', texto: t('recuperarContrasena.volverLogin') }}
      />

      <form onSubmit={manejarEnvio} className="acceso-formulario" aria-busy={cargando} noValidate>
        <div>
          <Label htmlFor="recuperar-email">{t('recuperarContrasena.email')}</Label>
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
            aria-invalid={Boolean(error?.campo)}
            aria-describedby={error?.campo ? ID_ERROR : undefined}
            className={CAMPO_ACCESO}
            required
          />
        </div>

        {error && (
          <AvisoAcceso id={ID_ERROR} tono={error.tono}>
            {error.texto}
          </AvisoAcceso>
        )}

        <BotonAcceso cargando={cargando} textoCargando={t('recuperarContrasena.enviando')}>
          {t('recuperarContrasena.enviar')}
        </BotonAcceso>
      </form>

      <p className="acceso-nota">{t('recuperarContrasena.notaSeguridad')}</p>
    </AuthShell>
  )
}
