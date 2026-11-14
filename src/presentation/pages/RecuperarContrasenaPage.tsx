import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Trans, useTranslation } from 'react-i18next'
import { ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, Info, Loader2, Mail, RotateCw } from 'lucide-react'

import { useCuentaRegresiva } from '@/application/hooks/useCuentaRegresiva'
import { codigoCompleto } from '@/domain/value-objects/codigoVerificacion'
import { restablecerPasswordConCodigo, solicitarRecuperacion } from '@/infrastructure/auth/credencialesService'
import { CODIGO_VERIFICACION_DEMO } from '@/infrastructure/demo/constantesDemo'
import { MODO_DEMO } from '@/infrastructure/demo/modoDemo'
import { cn } from '@/lib/utils'
import { AuthShell } from '../components/auth/AuthShell'
import { CamposPasswordNueva } from '../components/auth/CamposPasswordNueva'
import { ColdCareBrandPanel } from '../components/auth/ColdCareBrandPanel'
import { TransicionPasos } from '../components/auth/TransicionPasos'
import { errorPasswordNueva } from '../components/auth/errorPasswordNueva'
import { CampoCodigo, type CampoCodigoRef, type EstadoCampoCodigo } from '../components/ui/campo-codigo'
import { Input, Label } from '../components/ui/input'

type Paso = 'correo' | 'codigo' | 'listo'
type Aviso = { tipo: 'error' | 'info'; texto: string } | null

const PASOS: Paso[] = ['correo', 'codigo', 'listo']
const PATRON_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
/**
 * El backend no informa una espera para la recuperación (cuota de 3 envíos por
 * cuenta cada 15 min): se espacian los reenvíos en el cliente.
 */
const ESPERA_REENVIO_S = 60

/**
 * Recuperación de contraseña y activación de cuenta con código de 6 dígitos
 * (docs/operacion/CODIGOS_VERIFICACION.md, flujos 2 y 3):
 *
 * 1. correo → POST /api/auth/recuperar-password (202 siempre: no revela si la cuenta existe);
 * 2. código + contraseña nueva → POST /api/auth/restablecer-password;
 * 3. listo → iniciar sesión.
 *
 * Los correos enlazan a `?email=<correo>&modo=activar` (bienvenida, código de
 * 48 h) o `?email=<correo>&modo=recuperar` (recuperación, 10 min): quien llega
 * así ya tiene el código, por eso se empieza en el paso 2. Pedir otro desde el
 * paso 1 anularía el que tiene en la mano.
 */
export function RecuperarContrasenaPage() {
  const { t } = useTranslation()
  const [parametros, setParametros] = useSearchParams()
  const modo = parametros.get('modo')
  const activacion = modo === 'activar' || modo === 'activacion'
  const conCodigoEnMano = activacion || modo === 'recuperar'
  const emailInicial = (parametros.get('email') ?? '').trim()
  const emailValido = PATRON_EMAIL.test(emailInicial)

  const [paso, setPaso] = useState<Paso>(conCodigoEnMano && emailValido ? 'codigo' : 'correo')
  const [direccion, setDireccion] = useState<1 | -1>(1)
  const [email, setEmail] = useState(emailValido ? emailInicial : '')
  const [codigo, setCodigo] = useState('')
  const [password, setPassword] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [estadoCodigo, setEstadoCodigo] = useState<EstadoCampoCodigo>('normal')
  const [intentoFallido, setIntentoFallido] = useState(0)
  // Aviso del formulario (contraseña, servidor) y aviso junto a las casillas
  // (código incorrecto, reenvío): cada uno donde está el foco al aparecer.
  const [aviso, setAviso] = useState<Aviso>(null)
  const [avisoCodigo, setAvisoCodigo] = useState<Aviso>(null)
  const [cargando, setCargando] = useState(false)
  const [reenviando, setReenviando] = useState(false)
  // Pedir un código aquí emite uno de recuperación (10 min) que anula el de
  // bienvenida (48 h): desde entonces el texto debe hablar del nuevo.
  const [codigoPedido, setCodigoPedido] = useState(false)
  // En activación el código llegó con la bienvenida: se puede pedir otro ya.
  const [reenviarDesde, setReenviarDesde] = useState<number | null>(null)
  const esperaReenvio = useCuentaRegresiva(reenviarDesde)

  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const campoRef = useRef<CampoCodigoRef>(null)
  const volvioAlCorreo = useRef(false)

  // El correo de la URL solo rellena el formulario: se quita de la barra de
  // direcciones y del historial (`modo` se conserva para los textos).
  useEffect(() => {
    if (!parametros.has('email')) return
    setParametros(
      (actuales) => {
        const siguientes = new URLSearchParams(actuales)
        siguientes.delete('email')
        return siguientes
      },
      { replace: true },
    )
    // Solo al montar: el correo ya se copió al estado inicial.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // «Usar otro correo»: el campo se monta al terminar la transición, por eso
  // se enfoca desde la referencia y no desde un efecto.
  const refEmail = useCallback((nodo: HTMLInputElement | null) => {
    emailRef.current = nodo
    if (nodo && volvioAlCorreo.current) {
      volvioAlCorreo.current = false
      nodo.focus()
    }
  }, [])

  // «Listo» reemplaza el formulario: el foco va al título para que se lea el
  // resultado y no caiga al <body>.
  const refTituloListo = useCallback((nodo: HTMLHeadingElement | null) => nodo?.focus(), [])
  // Foco a las casillas tras el render que las rehabilita (deshabilitadas no lo reciben).
  const [pedirFoco, setPedirFoco] = useState(0)
  useEffect(() => {
    if (pedirFoco > 0) campoRef.current?.enfocar()
  }, [pedirFoco])

  const texto = (clave: string) => t(`recuperarContrasena.${activacion ? 'activacion' : 'recuperacion'}.${clave}`)

  const irA = (siguiente: Paso) => {
    setDireccion(PASOS.indexOf(siguiente) >= PASOS.indexOf(paso) ? 1 : -1)
    setAviso(null)
    setAvisoCodigo(null)
    setPaso(siguiente)
  }

  const mensajeSolicitud = (resultado: Awaited<ReturnType<typeof solicitarRecuperacion>>) =>
    resultado === 'no_disponible'
      ? t('recuperarContrasena.noDisponible')
      : resultado === 'limite'
        ? t('login.errorDemasiadosIntentos')
        : t('login.errorServidor')

  const pedirCodigo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAviso(null)
    const normalizado = email.trim()
    if (!normalizado) {
      setAviso({ tipo: 'error', texto: t('login.errorEmailVacio') })
      emailRef.current?.focus()
      return
    }
    if (!PATRON_EMAIL.test(normalizado)) {
      setAviso({ tipo: 'error', texto: t('login.errorEmailInvalido') })
      emailRef.current?.focus()
      return
    }
    setCargando(true)
    const resultado = await solicitarRecuperacion(normalizado)
    setCargando(false)
    if (resultado !== 'enviado') {
      setAviso({ tipo: 'error', texto: mensajeSolicitud(resultado) })
      return
    }
    setEmail(normalizado)
    setCodigo('')
    setEstadoCodigo('normal')
    setCodigoPedido(true)
    setReenviarDesde(Date.now() + ESPERA_REENVIO_S * 1000)
    irA('codigo')
  }

  const reenviar = async () => {
    if (reenviando || esperaReenvio > 0) return
    setReenviando(true)
    const resultado = await solicitarRecuperacion(email)
    setReenviando(false)
    if (resultado === 'enviado') {
      setReenviarDesde(Date.now() + ESPERA_REENVIO_S * 1000)
      setCodigo('')
      setEstadoCodigo('normal')
      setCodigoPedido(true)
      setAvisoCodigo({ tipo: 'info', texto: t('recuperarContrasena.reenviado') })
    } else {
      setAvisoCodigo({ tipo: 'error', texto: mensajeSolicitud(resultado) })
    }
    // El botón se deshabilita mientras envía: el foco vuelve a las casillas.
    setPedirFoco((n) => n + 1)
  }

  const rechazarCodigo = (mensaje: string) => {
    setEstadoCodigo('error')
    setIntentoFallido((n) => n + 1)
    setAvisoCodigo({ tipo: 'error', texto: mensaje })
  }

  const confirmar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAviso(null)
    setAvisoCodigo(null)
    if (!codigoCompleto(codigo)) {
      rechazarCodigo(t('loginCodigo.errorIncompleto'))
      setPedirFoco((n) => n + 1)
      return
    }
    const problema = errorPasswordNueva(t, password, confirmacion)
    if (problema) {
      setAviso({ tipo: 'error', texto: problema })
      passwordRef.current?.focus()
      return
    }
    setCargando(true)
    const resultado = await restablecerPasswordConCodigo(email, codigo, password)
    setCargando(false)
    switch (resultado) {
      case 'ok':
        setEstadoCodigo('exito')
        irA('listo')
        return
      case 'codigo_invalido':
        setCodigo('')
        rechazarCodigo(t('recuperarContrasena.errorCodigo'))
        setPedirFoco((n) => n + 1)
        return
      case 'password_invalida':
        setAviso({ tipo: 'error', texto: t('restablecerContrasena.politica.sin_letras_y_digitos') })
        passwordRef.current?.focus()
        return
      case 'limite':
        setAviso({ tipo: 'error', texto: t('login.errorDemasiadosIntentos') })
        return
      default:
        setAviso({ tipo: 'error', texto: t('login.errorServidor') })
    }
  }

  const cambiarCodigo = (valor: string) => {
    setCodigo(valor)
    if (estadoCodigo === 'error') setEstadoCodigo('normal')
    if (avisoCodigo?.tipo === 'error') setAvisoCodigo(null)
  }

  const claveSubtituloCodigo = activacion
    ? codigoPedido
      ? 'recuperarContrasena.activacion.subtituloCodigoNuevo'
      : 'recuperarContrasena.activacion.subtituloCodigo'
    : 'recuperarContrasena.recuperacion.subtituloCodigo'

  const indicePaso = PASOS.indexOf(paso)

  return (
    <AuthShell brandPanel={<ColdCareBrandPanel />}>
      <div className="w-full">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link
            to="/login"
            className="-ml-1 inline-flex min-h-11 items-center gap-1.5 rounded-md px-1 text-sm font-semibold text-marca-texto hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            <span>{t('recuperarContrasena.volverLogin')}</span>
          </Link>
          <Progreso indice={indicePaso} etiquetas={PASOS.map((p) => t(`recuperarContrasena.pasos.${p}`))} />
        </div>

        <TransicionPasos paso={paso} direccion={direccion}>
          {paso === 'correo' && (
            <>
              <Encabezado titulo={texto('titulo')} subtitulo={texto('subtitulo')} />
              <form onSubmit={pedirCodigo} className="space-y-4" noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="recuperar-email">{t('recuperarContrasena.email')}</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
                    <Input
                      ref={refEmail}
                      id="recuperar-email"
                      type="email"
                      autoComplete="email"
                      placeholder={t('recuperarContrasena.emailPlaceholder')}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      aria-invalid={aviso?.tipo === 'error' || undefined}
                      aria-describedby="recuperar-aviso"
                      className="h-12 rounded-[10px] pl-10 text-[15px]"
                      required
                    />
                  </div>
                </div>
                <AvisoFormulario id="recuperar-aviso" aviso={aviso} />
                <BotonPrincipal cargando={cargando} textoCargando={t('recuperarContrasena.enviando')}>
                  <span>{t('recuperarContrasena.enviar')}</span>
                  <ArrowRight className="size-4" aria-hidden />
                </BotonPrincipal>
                <p className="text-center text-xs leading-5 text-faint">{t('recuperarContrasena.notaSeguridad')}</p>
              </form>
            </>
          )}

          {paso === 'codigo' && (
            <>
              <Encabezado
                titulo={texto('tituloCodigo')}
                subtitulo={
                  <Trans
                    i18nKey={claveSubtituloCodigo}
                    values={{ email }}
                    components={{ email: <strong className="font-semibold break-words text-foreground" /> }}
                  />
                }
                idSubtitulo="recuperar-codigo-ayuda"
              />
              <form onSubmit={confirmar} className="space-y-4" noValidate>
                {/* Gestores de contraseñas: asocian la contraseña nueva a esta cuenta. */}
                <input type="email" name="email" autoComplete="username" value={email} readOnly hidden />
                <div className="space-y-2">
                  <p className="text-[13px] leading-5 font-medium text-subtle">{t('codigo.etiqueta')}</p>
                  <CampoCodigo
                    ref={campoRef}
                    idBase="recuperar-codigo"
                    etiqueta={t('codigo.etiqueta')}
                    describedBy="recuperar-codigo-ayuda recuperar-codigo-aviso"
                    valor={codigo}
                    onCambiar={cambiarCodigo}
                    onCompleto={() => passwordRef.current?.focus()}
                    estado={estadoCodigo}
                    intentoFallido={intentoFallido}
                    disabled={cargando}
                    autoFocus
                  />
                  <div className="flex min-h-11 items-center justify-between gap-3 text-[13px]">
                    <button
                      type="button"
                      onClick={() => {
                        setCodigo('')
                        volvioAlCorreo.current = true
                        irA('correo')
                      }}
                      className="inline-flex min-h-11 cursor-pointer items-center rounded-md px-1 font-medium text-muted hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
                    >
                      {t('recuperarContrasena.cambiarEmail')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void reenviar()}
                      disabled={reenviando || esperaReenvio > 0}
                      className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-md px-1 font-semibold text-marca-texto tabular-nums hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:cursor-default disabled:font-medium disabled:text-faint disabled:no-underline"
                    >
                      <RotateCw className={cn('size-3.5', reenviando && 'animate-spin')} aria-hidden />
                      {esperaReenvio > 0
                        ? t('loginCodigo.reenviarEn', { segundos: esperaReenvio })
                        : reenviando
                          ? t('loginCodigo.reenviando')
                          : t('loginCodigo.reenviar')}
                    </button>
                  </div>
                  <AvisoFormulario id="recuperar-codigo-aviso" aviso={avisoCodigo} />
                </div>

                <CamposPasswordNueva
                  password={password}
                  confirmacion={confirmacion}
                  onPassword={setPassword}
                  onConfirmacion={setConfirmacion}
                  passwordRef={passwordRef}
                />

                <AvisoFormulario id="recuperar-aviso" aviso={aviso} />

                <BotonPrincipal cargando={cargando} textoCargando={t('restablecerContrasena.actualizando')}>
                  <span>{texto('boton')}</span>
                </BotonPrincipal>
              </form>

              {MODO_DEMO && (
                <p className="mt-6 rounded-xl border border-dashed border-border-strong bg-surface-sunken/60 px-4 py-3 text-sm text-muted">
                  {t('loginCodigo.demoCodigo')}{' '}
                  <span className="font-mono text-[15px] font-semibold tracking-[0.18em] text-foreground">{CODIGO_VERIFICACION_DEMO}</span>
                </p>
              )}
            </>
          )}

          {paso === 'listo' && (
            <div className="space-y-6">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-success-100 text-success-700 ring-1 ring-inset ring-success-600/25 animate-(--animate-pop-in)">
                <CheckCircle2 className="size-6" aria-hidden />
              </div>
              <div>
                <h2
                  ref={refTituloListo}
                  tabIndex={-1}
                  aria-describedby="recuperar-listo-mensaje"
                  className="text-[30px] leading-[1.1] font-semibold tracking-[-0.03em] text-foreground outline-none"
                >
                  {texto('exitoTitulo')}
                </h2>
                <p id="recuperar-listo-mensaje" className="mt-2 text-[15px] leading-6 text-muted">
                  {texto('exitoMensaje')}
                </p>
              </div>
              <Link
                to="/login"
                className="coldcare-primary-action flex h-12 w-full items-center justify-center gap-2 rounded-[10px] px-4 text-[15px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span>{t('recuperarContrasena.irLogin')}</span>
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
          )}
        </TransicionPasos>
      </div>
    </AuthShell>
  )
}

function Encabezado({ titulo, subtitulo, idSubtitulo }: { titulo: string; subtitulo: ReactNode; idSubtitulo?: string }) {
  return (
    <div className="mb-7">
      <h2 className="text-[30px] leading-[1.1] font-semibold tracking-[-0.03em] text-foreground">{titulo}</h2>
      <p id={idSubtitulo} className="mt-2 text-[15px] leading-6 text-muted">
        {subtitulo}
      </p>
    </div>
  )
}

/**
 * Regiones vivas siempre montadas: solo cambia su contenido, así los lectores
 * de pantalla anuncian el aviso (uno que aparece ya lleno suele omitirse).
 */
function AvisoFormulario({ id, aviso }: { id: string; aviso: Aviso }) {
  return (
    <div id={id}>
      <div role="alert">
        {aviso?.tipo === 'error' && (
          <p className="flex items-start gap-2.5 rounded-(--radius-field) bg-critical-tint px-3 py-2.5 text-sm leading-5 text-critical ring-1 ring-inset ring-critical/25 animate-fade">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {aviso.texto}
          </p>
        )}
      </div>
      <div role="status">
        {aviso?.tipo === 'info' && (
          <p className="flex items-start gap-2.5 rounded-(--radius-field) bg-primary-tint px-3 py-2.5 text-sm leading-5 text-foreground ring-1 ring-inset ring-primary/20 animate-fade">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            {aviso.texto}
          </p>
        )}
      </div>
    </div>
  )
}

function BotonPrincipal({ cargando, textoCargando, children }: { cargando: boolean; textoCargando: string; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={cargando}
      className="coldcare-primary-action flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] px-4 text-[15px] font-semibold disabled:cursor-wait disabled:opacity-70"
    >
      {cargando ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          <span>{textoCargando}</span>
        </>
      ) : (
        children
      )}
    </button>
  )
}

/**
 * Progreso de tres tramos (SmoothUI «Animated Stepper»): cada tramo se llena
 * con scaleX desde la izquierda, sin animar el ancho.
 */
function Progreso({ indice, etiquetas }: { indice: number; etiquetas: string[] }) {
  const { t } = useTranslation()
  const total = etiquetas.length
  return (
    <div
      role="progressbar"
      aria-label={t('recuperarContrasena.progreso')}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={indice + 1}
      aria-valuetext={t('recuperarContrasena.pasoDe', { actual: indice + 1, total, nombre: etiquetas[indice] })}
      className="flex items-center gap-3"
    >
      <span className="hidden text-xs font-medium text-muted tabular-nums sm:inline">
        {t('recuperarContrasena.pasoDe', { actual: indice + 1, total, nombre: etiquetas[indice] })}
      </span>
      <span className="flex gap-1" aria-hidden>
        {etiquetas.map((etiqueta, i) => (
          <span key={etiqueta} className="relative h-1 w-6 overflow-hidden rounded-full bg-border-strong">
            <span
              className={cn(
                'absolute inset-0 origin-left rounded-full bg-primary transition-transform duration-(--duration-reveal) ease-(--ease-ui)',
                i <= indice ? 'scale-x-100' : 'scale-x-0',
              )}
            />
          </span>
        ))}
      </span>
    </div>
  )
}
