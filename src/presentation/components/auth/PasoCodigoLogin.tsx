import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { useReducedMotion } from 'motion/react'
import { ArrowLeft, ArrowRight, Check, CircleAlert, Clock, Info, Loader2, MailCheck, RotateCw } from 'lucide-react'

import { useAuthStore } from '@/application/stores/authStore'
import { formatearMinSeg, useCuentaRegresiva } from '@/application/hooks/useCuentaRegresiva'
import {
  codigoCompleto,
  type DesafioCodigo,
  type MotivoRechazoCodigo,
} from '@/domain/value-objects/codigoVerificacion'
import { motivoRechazoCodigo, reenviarCodigoLogin, segundosParaReintentar } from '@/infrastructure/auth/authService'
import { CODIGO_VERIFICACION_DEMO } from '@/infrastructure/demo/constantesDemo'
import { MODO_DEMO } from '@/infrastructure/demo/modoDemo'
import { cn } from '@/lib/utils'
import { CampoCodigo, type CampoCodigoRef, type EstadoCampoCodigo } from '../ui/campo-codigo'

type Aviso = { tipo: 'error' | 'info'; texto: string } | null
/** A dónde vuelve el foco en las credenciales: otra cuenta o reintentar la misma. */
export type DestinoVolver = 'email' | 'password'

/** Rechazos que invalidan el desafío: solo queda volver a ingresar. */
const TERMINALES: ReadonlySet<MotivoRechazoCodigo> = new Set(['agotado', 'caducado', 'bloqueado'])

/**
 * Segundo paso del login con OTP_LOGIN_ENABLED: el código de 6 dígitos que el
 * backend envió al correo. Muestra el destino enmascarado, la vigencia, el
 * reenvío con su espera y los rechazos sin revelar más que el backend.
 */
export function PasoCodigoLogin({
  desafio: desafioInicial,
  onVerificado,
  onVolver,
}: {
  desafio: DesafioCodigo
  onVerificado: () => void
  onVolver: (destino: DestinoVolver) => void
}) {
  const { t } = useTranslation()
  const reducir = useReducedMotion()
  const verificarCodigo = useAuthStore((state) => state.verificarCodigo)
  const campoRef = useRef<CampoCodigoRef>(null)
  const volverRef = useRef<HTMLButtonElement>(null)
  const salida = useRef<number | null>(null)

  const [desafio, setDesafio] = useState(desafioInicial)
  const [venceEn, setVenceEn] = useState(() => Date.now() + desafioInicial.expiraEnSegundos * 1000)
  const [reenviarDesde, setReenviarDesde] = useState(() => Date.now() + desafioInicial.reenviarEnSegundos * 1000)
  const [codigo, setCodigo] = useState('')
  const [estado, setEstado] = useState<EstadoCampoCodigo>('normal')
  const [intentoFallido, setIntentoFallido] = useState(0)
  const [aviso, setAviso] = useState<Aviso>(null)
  const [terminal, setTerminal] = useState(false)
  const [verificando, setVerificando] = useState(false)
  const [reenviando, setReenviando] = useState(false)
  const enCurso = useRef(false)
  // El foco vuelve a las casillas después del render que las rehabilita: una
  // casilla deshabilitada no puede recibirlo.
  const [pedirFoco, setPedirFoco] = useState(0)
  useEffect(() => {
    if (pedirFoco > 0) campoRef.current?.enfocar()
  }, [pedirFoco])

  const restante = useCuentaRegresiva(venceEn)
  const esperaReenvio = useCuentaRegresiva(reenviarDesde)
  const vencido = restante === 0
  const bloqueado = terminal || vencido

  // Al vencer, el backend ya no acepta ni reenvía este desafío.
  useEffect(() => {
    if (vencido && !terminal) setAviso({ tipo: 'error', texto: t('loginCodigo.errorVencido') })
  }, [vencido, terminal, t])

  // Las casillas quedan deshabilitadas y el botón de enviar se reemplaza: el
  // foco pasa a la única acción posible en vez de caer al <body>.
  useEffect(() => {
    if (bloqueado) volverRef.current?.focus()
  }, [bloqueado])

  useEffect(
    () => () => {
      if (salida.current !== null) window.clearTimeout(salida.current)
    },
    [],
  )

  const mensajeRechazo = (motivo: MotivoRechazoCodigo): string => {
    switch (motivo) {
      case 'incorrecto':
        return t('loginCodigo.errorIncorrecto')
      case 'agotado':
        return t('loginCodigo.errorAgotado')
      case 'caducado':
        return t('loginCodigo.errorCaducado')
      case 'bloqueado':
        return t('loginCodigo.errorBloqueado')
      case 'limite':
        return t('login.errorDemasiadosIntentos')
      case 'no_disponible':
        return t('loginCodigo.errorNoDisponible')
      default:
        return t('login.errorServidor')
    }
  }

  const verificar = async (valor: string) => {
    if (enCurso.current || bloqueado) return
    if (!codigoCompleto(valor)) {
      setEstado('error')
      setAviso({ tipo: 'error', texto: t('loginCodigo.errorIncompleto') })
      setIntentoFallido((n) => n + 1)
      setPedirFoco((n) => n + 1)
      return
    }
    enCurso.current = true
    setVerificando(true)
    setAviso(null)
    try {
      await verificarCodigo(desafio.desafio, valor)
      setEstado('exito')
      // Deja ver el pulso de confirmación (240 ms) antes de entrar al panel.
      if (reducir) onVerificado()
      else salida.current = window.setTimeout(onVerificado, 240)
    } catch (error) {
      const motivo = motivoRechazoCodigo(error)
      setEstado('error')
      setIntentoFallido((n) => n + 1)
      setAviso({ tipo: 'error', texto: mensajeRechazo(motivo) })
      if (TERMINALES.has(motivo)) {
        setTerminal(true)
      } else {
        setCodigo('')
        setPedirFoco((n) => n + 1)
      }
      enCurso.current = false
      setVerificando(false)
    }
  }

  const reenviar = async () => {
    if (reenviando || esperaReenvio > 0 || bloqueado) return
    setReenviando(true)
    try {
      const nuevo = await reenviarCodigoLogin(desafio.desafio)
      const ahora = Date.now()
      setDesafio(nuevo)
      setVenceEn(ahora + nuevo.expiraEnSegundos * 1000)
      setReenviarDesde(ahora + nuevo.reenviarEnSegundos * 1000)
      setCodigo('')
      setEstado('normal')
      setAviso({ tipo: 'info', texto: t('loginCodigo.reenviado') })
      setPedirFoco((n) => n + 1)
    } catch (error) {
      const motivo = motivoRechazoCodigo(error)
      if (motivo === 'limite') {
        const segundos = segundosParaReintentar(error)
        if (segundos) setReenviarDesde(Date.now() + segundos * 1000)
        setAviso({
          tipo: 'error',
          texto: segundos ? t('loginCodigo.errorEsperaReenvio', { segundos }) : t('login.errorDemasiadosIntentos'),
        })
        setPedirFoco((n) => n + 1)
      } else if (motivo === 'no_disponible') {
        // El backend ya reemplazó el código y reinició la espera antes de que
        // fallara el correo (auth_router `_enviar_codigo_o_503`).
        setReenviarDesde(Date.now() + desafio.reenviarEnSegundos * 1000)
        setCodigo('')
        setEstado('normal')
        setAviso({ tipo: 'error', texto: t('loginCodigo.errorReenvioNoEnviado') })
        setPedirFoco((n) => n + 1)
      } else if (TERMINALES.has(motivo)) {
        setTerminal(true)
        setAviso({ tipo: 'error', texto: mensajeRechazo(motivo) })
      } else {
        setAviso({ tipo: 'error', texto: mensajeRechazo(motivo) })
        setPedirFoco((n) => n + 1)
      }
    } finally {
      setReenviando(false)
    }
  }

  const enviar = (event: FormEvent) => {
    event.preventDefault()
    void verificar(codigo)
  }

  const cambiarCodigo = (valor: string) => {
    setCodigo(valor)
    if (estado === 'error') setEstado('normal')
    if (aviso?.tipo === 'error' && !bloqueado) setAviso(null)
  }

  const usarCodigoDemo = () => {
    setCodigo(CODIGO_VERIFICACION_DEMO)
    void verificar(CODIGO_VERIFICACION_DEMO)
  }

  const exito = estado === 'exito'

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => onVolver('email')}
        className="mb-6 -ml-1 inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-md px-1 text-sm font-semibold text-marca-texto hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        {t('loginCodigo.volver')}
      </button>

      <div className="mb-7">
        <div className="mb-5 flex size-11 items-center justify-center rounded-xl bg-primary-tint text-primary ring-1 ring-inset ring-primary/15">
          <MailCheck className="size-5" aria-hidden />
        </div>
        <h1 className="text-[30px] leading-[1.1] font-semibold tracking-[-0.03em] text-foreground">
          {t('loginCodigo.titulo')}
        </h1>
        <p id="login-codigo-ayuda" className="mt-2 text-[15px] leading-6 text-muted">
          <Trans
            i18nKey="loginCodigo.subtitulo"
            values={{ email: desafio.emailEnmascarado }}
            components={{ email: <strong className="font-semibold text-foreground" /> }}
          />
        </p>
      </div>

      <form className="space-y-4" onSubmit={enviar} noValidate>
        <div className="space-y-2">
          <p id="login-codigo-etiqueta" className="text-[13px] leading-5 font-medium text-subtle">
            {t('codigo.etiqueta')}
          </p>
          <CampoCodigo
            ref={campoRef}
            idBase="login-codigo"
            etiqueta={t('codigo.etiqueta')}
            describedBy="login-codigo-ayuda login-codigo-aviso"
            valor={codigo}
            onCambiar={cambiarCodigo}
            onCompleto={(valor) => void verificar(valor)}
            estado={estado}
            intentoFallido={intentoFallido}
            disabled={verificando || exito || bloqueado}
            autoFocus
          />
          <div className="flex min-h-11 items-center justify-between gap-3 text-[13px]">
            <span className={cn('inline-flex items-center gap-1.5 tabular-nums', vencido ? 'text-critical' : 'text-muted')}>
              <Clock className="size-3.5 shrink-0" aria-hidden />
              {vencido ? t('loginCodigo.vencido') : t('loginCodigo.venceEn', { tiempo: formatearMinSeg(restante) })}
            </span>
            {!bloqueado && (
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
            )}
          </div>
        </div>

        {/* Regiones vivas siempre montadas: solo cambia su contenido, así los
            lectores de pantalla anuncian el aviso (uno ya lleno al aparecer se omite). */}
        <div id="login-codigo-aviso">
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

        {bloqueado ? (
          <button
            ref={volverRef}
            type="button"
            onClick={() => onVolver('password')}
            aria-describedby="login-codigo-aviso"
            className="coldcare-primary-action flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] px-4 text-[15px] font-semibold"
          >
            <ArrowLeft className="size-4" aria-hidden />
            <span>{t('loginCodigo.volverIniciar')}</span>
          </button>
        ) : (
          <button
            type="submit"
            disabled={verificando || exito}
            className="coldcare-primary-action flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] px-4 text-[15px] font-semibold disabled:cursor-wait disabled:opacity-80"
          >
            {/* Text swap (transitions.dev): el rótulo cambia con un fundido corto. */}
            <span key={exito ? 'exito' : verificando ? 'verificando' : 'listo'} className="inline-flex items-center gap-2 animate-fade">
              {exito ? (
                <>
                  <Check className="size-4" aria-hidden />
                  <span>{t('loginCodigo.verificado')}</span>
                </>
              ) : verificando ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  <span>{t('loginCodigo.verificando')}</span>
                </>
              ) : (
                <>
                  <span>{t('loginCodigo.verificar')}</span>
                  <ArrowRight className="size-4" aria-hidden />
                </>
              )}
            </span>
          </button>
        )}

        {!bloqueado && <p className="text-center text-xs leading-5 text-faint">{t('loginCodigo.ayuda')}</p>}
      </form>

      {MODO_DEMO && !bloqueado && (
        <div className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-dashed border-border-strong bg-surface-sunken/60 px-4 py-3">
          <p className="text-sm text-muted">
            {t('loginCodigo.demoCodigo')}{' '}
            <span className="font-mono text-[15px] font-semibold tracking-[0.18em] text-foreground">{CODIGO_VERIFICACION_DEMO}</span>
          </p>
          <button
            type="button"
            onClick={usarCodigoDemo}
            disabled={verificando || exito}
            className="inline-flex min-h-11 shrink-0 cursor-pointer items-center rounded-md px-2 text-sm font-semibold text-marca-texto hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:cursor-default disabled:text-faint"
          >
            {t('loginCodigo.demoUsar')}
          </button>
        </div>
      )}
    </div>
  )
}
