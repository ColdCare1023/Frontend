import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

import { consumirTokenDelEnlace, restablecerPassword } from '@/infrastructure/auth/credencialesService'
import { cn } from '@/lib/utils'
import { AuthShell } from '../components/auth/AuthShell'
import { CamposPasswordNueva } from '../components/auth/CamposPasswordNueva'
import { CTA_ACCESO } from '../components/auth/clasesAcceso'
import { errorPasswordNueva } from '../components/auth/errorPasswordNueva'
import { ColdCareBrandPanel } from '../components/auth/ColdCareBrandPanel'
import {
  AvisoAcceso,
  BotonAcceso,
  CampoDesenlace,
  EncabezadoAcceso,
  type ErrorAcceso,
} from '../components/auth/PiezasAcceso'

const ID_ERROR = 'restablecer-error'

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
  // `campo`: el problema está en la contraseña nueva, no en el servidor.
  const [error, setError] = useState<(ErrorAcceso & { campo?: boolean }) | null>(null)

  const enviar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const problema = errorPasswordNueva(t, password, confirmacion)
    if (problema) {
      setError({ texto: problema, tono: 'error', campo: true })
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
    else if (resultado === 'password_invalida')
      setError({ texto: t('restablecerContrasena.politica.sin_letras_y_digitos'), tono: 'error', campo: true })
    else if (resultado === 'limite') setError({ texto: t('login.errorDemasiadosIntentos'), tono: 'bloqueo' })
    else setError({ texto: t('login.errorServidor'), tono: 'error' })
  }

  const conFormulario = !enlaceInvalido && !exito

  return (
    <AuthShell brandPanel={<ColdCareBrandPanel />}>
      <EncabezadoAcceso
        titulo={t('restablecerContrasena.titulo')}
        bajada={conFormulario ? t('restablecerContrasena.subtitulo') : undefined}
        volver={exito ? undefined : { a: '/login', texto: t('recuperarContrasena.volverLogin') }}
      />

      {enlaceInvalido ? (
        <>
          <CampoDesenlace tono="rojo" role="alert" titulo={t('restablecerContrasena.tokenInvalido')}>
            {t('restablecerContrasena.tokenInvalidoDetalle')}
          </CampoDesenlace>
          <Link to="/recuperar-contrasena" className={cn(CTA_ACCESO, 'mt-5 lg:mt-7')}>
            {t('restablecerContrasena.solicitarNuevo')}
          </Link>
        </>
      ) : exito ? (
        <>
          <CampoDesenlace tono="cian" role="status" titulo={t('restablecerContrasena.exitoTitulo')}>
            {t('restablecerContrasena.exitoMensaje')}
          </CampoDesenlace>
          <Link to="/login" className={cn(CTA_ACCESO, 'mt-5 lg:mt-7')}>
            {t('restablecerContrasena.irLogin')}
          </Link>
        </>
      ) : (
        <form onSubmit={(e) => void enviar(e)} className="acceso-formulario" aria-busy={cargando} noValidate>
          <CamposPasswordNueva
            password={password}
            confirmacion={confirmacion}
            onPassword={setPassword}
            onConfirmacion={setConfirmacion}
            passwordRef={passwordRef}
            errorId={error?.campo ? ID_ERROR : undefined}
          />
          {error && (
            <AvisoAcceso id={ID_ERROR} tono={error.tono}>
              {error.texto}
            </AvisoAcceso>
          )}
          <BotonAcceso cargando={cargando} textoCargando={t('restablecerContrasena.actualizando')}>
            {t('restablecerContrasena.boton')}
          </BotonAcceso>
        </form>
      )}
    </AuthShell>
  )
}
