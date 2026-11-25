import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { Link, useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ArrowRight, Check, CircleAlert, ClipboardPaste, Copy, Link2Off, ShieldCheck } from 'lucide-react'

import { codigoDesdeFragmento } from '@/domain/value-objects/codigoVerificacion'
import { cn } from '@/lib/utils'
import { AuthShell } from '../components/auth/AuthShell'
import { CambioTexto } from '../components/ui/cambio-texto'

type EstadoCopia = 'pendiente' | 'copiado' | 'fallido'

/** Nunca lanza: sin API, sin permiso o sin gesto del usuario devuelve `false`. */
async function escribirPortapapeles(texto: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) return false
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    return false
  }
}

/**
 * Destino del botón «Copiar código» de los correos antiguos de ColdCare
 * (`/copiar-codigo#123456`). Un correo no puede ejecutar código, así que el
 * enlace trae el código en el fragmento: no llega al servidor, se quita de la
 * URL antes de pintar y no se guarda ni se registra en ningún lado.
 *
 * Pública y sin backend: funciona igual en demo y con el servidor real.
 */
export function CopiarCodigoPage() {
  const { t } = useTranslation()
  const ubicacion = useLocation()
  const [codigo, setCodigo] = useState<string | null>(null)
  const [estado, setEstado] = useState<EstadoCopia>('pendiente')
  const digitosRef = useRef<HTMLSpanElement>(null)
  const intentoActual = useRef(0)

  const recibir = useCallback((desdeHistorial = false) => {
    const { pathname, search, hash, href } = window.location
    // location.hash es vacío tanto para la URL limpia como para un enlace «#».
    const tieneFragmento = href.includes('#')
    if (!tieneFragmento && !desdeHistorial) return
    const nuevo = codigoDesdeFragmento(hash)
    if (tieneFragmento) window.history.replaceState(window.history.state, '', pathname + search)

    const intento = ++intentoActual.current
    setCodigo(nuevo)
    setEstado('pendiente')
    if (nuevo) {
      // Sin gesto, el navegador puede rechazar la copia. El botón queda disponible.
      void escribirPortapapeles(nuevo).then((ok) => {
        if (ok && intento === intentoActual.current) setEstado('copiado')
      })
    }
  }, [])

  useLayoutEffect(() => {
    const ruta = window.location.pathname
    const alNavegar = (evento: Event) => {
      if (window.location.pathname === ruta) recibir(evento.type === 'popstate')
    }
    window.addEventListener('popstate', alNavegar, true)
    window.addEventListener('hashchange', alNavegar)
    return () => {
      window.removeEventListener('popstate', alNavegar, true)
      window.removeEventListener('hashchange', alNavegar)
    }
  }, [recibir])

  // También recibe los enlaces del router que llaman a pushState sin hashchange.
  useLayoutEffect(() => { recibir() }, [ubicacion, recibir])

  if (!codigo) return <EnlaceSinCodigo />

  const copiar = async () => {
    const intento = ++intentoActual.current
    const ok = await escribirPortapapeles(codigo)
    if (intento !== intentoActual.current || !digitosRef.current) return
    if (ok) {
      setEstado('copiado')
      return
    }
    setEstado('fallido')
    // Queda seleccionado para copiarlo con el teclado o el menú del sistema.
    const nodo = digitosRef.current
    if (nodo) window.getSelection()?.selectAllChildren(nodo)
  }

  const copiado = estado === 'copiado'

  return (
    <AuthShell>
      <div className="w-full">
        <Link
          to="/login"
          className="-ml-1 mb-6 inline-flex min-h-11 items-center gap-1.5 rounded-md px-1 text-sm font-semibold text-marca-texto hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          <span>{t('copiarCodigo.volver')}</span>
        </Link>

        <p className="eyebrow text-faint">{t('copiarCodigo.etiqueta')}</p>
        <h1 className="mt-2 text-[30px] leading-[1.1] font-semibold tracking-[-0.03em] text-foreground">{t('copiarCodigo.titulo')}</h1>
        <p className="mt-2 text-[15px] leading-6 text-muted">{t('copiarCodigo.subtitulo')}</p>

        <div className="mt-7 overflow-hidden rounded-(--radius-card) border border-border bg-surface">
          {/* Hilo térmico de la marca (frío → cálido), solo decorativo. */}
          <div aria-hidden className="h-0.5 bg-[linear-gradient(90deg,#00d1ff,#0b5cff_52%,#ff7aa2)]" />
          <p className="flex justify-center px-4 py-8 sm:py-10">
            <span className="sr-only">{t('copiarCodigo.codigoLector', { digitos: codigo.split('').join(' ') })}</span>
            {/* Un toque selecciona el código entero; sin espacios en el texto. */}
            <span
              ref={digitosRef}
              id="copiar-codigo-digitos"
              aria-hidden
              className="nums codigo -mr-[0.08em] whitespace-nowrap text-[52px] leading-none font-semibold tracking-[0.08em] text-foreground select-all sm:text-[60px]"
            >
              {codigo.split('').map((digito, i) => (
                <span key={i} className={cn('cifra-digito', i === 3 && 'ml-[0.28em]')} style={{ '--i': i } as CSSProperties}>
                  {digito}
                </span>
              ))}
            </span>
          </p>
          <p className="flex items-center justify-center gap-2 border-t border-border bg-surface-sunken/60 px-4 py-2.5 text-[13px] leading-5 text-muted">
            <ShieldCheck className="size-4 shrink-0 text-faint" aria-hidden />
            {t('copiarCodigo.seguridad')}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void copiar()}
          aria-describedby="copiar-codigo-pista"
          className="coldcare-primary-action mt-5 flex h-12 w-full cursor-pointer items-center justify-center rounded-[10px] px-4 text-[15px] font-semibold"
        >
          <CambioTexto
            texto={copiado ? t('copiarCodigo.copiado') : t('copiarCodigo.copiar')}
            icono={copiado ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          />
        </button>

        {/* Regiones siempre montadas: se anuncia el cambio de contenido. */}
        <div role="status" aria-live="polite" className="sr-only">
          {copiado ? t('copiarCodigo.copiado') : ''}
        </div>
        <div role="alert">
          {estado === 'fallido' && (
            <p className="mt-3 flex items-start gap-2.5 rounded-(--radius-field) bg-warning-100 px-3 py-2.5 text-sm leading-5 text-foreground ring-1 ring-inset ring-warning-600/30 animate-fade">
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning-700" aria-hidden />
              {t('copiarCodigo.errorCopiar')}
            </p>
          )}
        </div>

        <p
          id="copiar-codigo-pista"
          className={cn(
            'mt-4 flex items-center justify-center gap-2 text-center text-[13px] leading-5 transition-colors duration-(--duration-ui)',
            copiado ? 'text-foreground' : 'text-muted',
          )}
        >
          <ClipboardPaste className="size-4 shrink-0 text-faint" aria-hidden />
          {t('copiarCodigo.pista')}
        </p>
      </div>
    </AuthShell>
  )
}

/** Sin fragmento o con uno que no es un código: nada que copiar. */
function EnlaceSinCodigo() {
  const { t } = useTranslation()
  return (
    <AuthShell>
      <div className="w-full space-y-6">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-surface-sunken text-muted ring-1 ring-inset ring-border">
          <Link2Off className="size-6" aria-hidden />
        </div>
        <div>
          <h1 className="text-[30px] leading-[1.1] font-semibold tracking-[-0.03em] text-foreground">{t('copiarCodigo.invalido.titulo')}</h1>
          <p className="mt-2 text-[15px] leading-6 text-muted">{t('copiarCodigo.invalido.mensaje')}</p>
        </div>
        <Link
          to="/login"
          className="coldcare-primary-action flex h-12 w-full items-center justify-center gap-2 rounded-[10px] px-4 text-[15px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span>{t('copiarCodigo.invalido.irLogin')}</span>
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </AuthShell>
  )
}
