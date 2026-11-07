import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { CalendarDays } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import { Input } from './input'

/**
 * Selector de fecha (y hora, con `conHora`): campo que admite escritura y calendario en
 * un panel, adaptado de shadcn-datetime-picker (Maliksidk19, MIT). No bloquea horas
 * pasadas y usa el contrato del input nativo: `yyyy-MM-dd` o `yyyy-MM-ddTHH:mm`.
 *
 * El calendario (react-day-picker y los idiomas de date-fns) se descarga al ir a abrirlo:
 * al acercar el puntero o el foco al botón, o al tocarlo. El campo no lo necesita: lee y
 * escribe las fechas por su cuenta, así que funciona igual mientras tanto.
 */
const ISO_FECHA = 'yyyy-MM-dd'
const ISO_FECHA_HORA = "yyyy-MM-dd'T'HH:mm"
const PASO_MINUTOS = 30

const cargarCalendario = () => import('./calendario-fecha')
const CalendarioFecha = lazy(cargarCalendario)

function patronVisible(idioma: 'es' | 'en', conHora: boolean) {
  const fecha = idioma === 'en' ? 'MM/dd/yyyy' : 'dd/MM/yyyy'
  return conHora ? `${fecha} HH:mm` : fecha
}

const TOKENS = /yyyy|MM|dd|HH|mm/g
const dosCifras = (n: number) => String(n).padStart(2, '0')

/** Escribe una fecha con uno de los patrones de arriba (`yyyy`, `MM`, `dd`, `HH`, `mm`). */
function formatear(fecha: Date, patron: string) {
  const partes: Record<string, string> = {
    yyyy: String(fecha.getFullYear()).padStart(4, '0'),
    MM: dosCifras(fecha.getMonth() + 1),
    dd: dosCifras(fecha.getDate()),
    HH: dosCifras(fecha.getHours()),
    mm: dosCifras(fecha.getMinutes()),
  }
  return patron.replace("'T'", 'T').replace(TOKENS, (token) => partes[token])
}

/** Lee un texto con un patrón exacto. Vuelve a escribirlo para descartar el 31/02 o una hora que no existe. */
function leerCon(texto: string, patron: string): Date | null {
  const orden: string[] = []
  const fuente = patron.replace("'T'", 'T').replace(TOKENS, (token) => {
    orden.push(token)
    return token === 'yyyy' ? '(\\d{4})' : '(\\d{2})'
  })
  const coincide = new RegExp(`^${fuente}$`).exec(texto)
  if (!coincide) return null
  const valor = (token: string, base: number) => {
    const posicion = orden.indexOf(token)
    return posicion < 0 ? base : Number(coincide[posicion + 1])
  }
  const fecha = new Date(2000, 0, 1, valor('HH', 0), valor('mm', 0), 0, 0)
  fecha.setFullYear(valor('yyyy', 2000), valor('MM', 1) - 1, valor('dd', 1))
  return formatear(fecha, patron) === texto ? fecha : null
}

/** Interpreta texto exacto (ISO o el formato visible); nada parcial. */
function interpretar(texto: string, idioma: 'es' | 'en', conHora: boolean): Date | null {
  const limpio = texto.trim()
  if (!limpio) return null
  for (const patron of [conHora ? ISO_FECHA_HORA : ISO_FECHA, patronVisible(idioma, conHora)]) {
    const fecha = leerCon(limpio, patron)
    if (fecha) return fecha
  }
  return null
}

/** Mientras llega el calendario: su mismo tamaño, para que el panel no salte. */
function EsperaCalendario() {
  const { t } = useTranslation()
  return (
    <div role="status" className="w-[280px]">
      <span className="sr-only">{t('app.cargando')}</span>
      <div aria-hidden className="flex h-9 items-center justify-center">
        <span className="esqueleto h-3.5 w-28 rounded" />
      </div>
      <div aria-hidden className="mt-2 grid h-[276px] grid-cols-7 place-items-center">
        {Array.from({ length: 42 }, (_, i) => (
          <span key={i} className="esqueleto size-7 rounded-lg opacity-60" />
        ))}
      </div>
    </div>
  )
}

const HORARIOS = Array.from({ length: (24 * 60) / PASO_MINUTOS }, (_, i) => {
  const minutos = i * PASO_MINUTOS
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`
})

export function SelectorFecha({
  id,
  valor,
  onCambiar,
  conHora = false,
  invalido = false,
  disabled = false,
  className,
  ...aria
}: {
  id: string
  valor: string
  onCambiar: (valor: string) => void
  conHora?: boolean
  invalido?: boolean
  disabled?: boolean
  className?: string
  'aria-describedby'?: string
}) {
  const { t, i18n } = useTranslation()
  const idioma: 'es' | 'en' = i18n.resolvedLanguage === 'en' ? 'en' : 'es'
  const patron = patronVisible(idioma, conHora)
  const fecha = useMemo(() => interpretar(valor, idioma, conHora), [valor, idioma, conHora])
  const [texto, setTexto] = useState(() => (fecha ? formatear(fecha, patron) : ''))
  const [abierto, setAbierto] = useState(false)
  const enfocado = useRef(false)
  const listaHoras = useRef<HTMLDivElement>(null)
  const horaActual = fecha ? formatear(fecha, 'HH:mm') : null

  // El valor externo manda, salvo mientras la persona está escribiendo.
  useEffect(() => {
    if (!enfocado.current) setTexto(fecha ? formatear(fecha, patron) : '')
  }, [fecha, patron])

  // Al abrir, la lista de horas se centra en la elegida.
  useEffect(() => {
    if (!abierto || !horaActual) return
    const marco = requestAnimationFrame(() => {
      const elegido = listaHoras.current?.querySelector<HTMLElement>('[aria-pressed="true"]')
      elegido?.scrollIntoView({ block: 'center', inline: 'center' })
    })
    return () => cancelAnimationFrame(marco)
  }, [abierto, horaActual])

  const emitir = (nueva: Date | null) => onCambiar(nueva ? formatear(nueva, conHora ? ISO_FECHA_HORA : ISO_FECHA) : '')

  const elegirDia = (dia: Date | undefined) => {
    if (!dia) return
    const nueva = new Date(dia)
    nueva.setHours(fecha?.getHours() ?? 0, fecha?.getMinutes() ?? 0, 0, 0)
    emitir(nueva)
    if (!conHora) setAbierto(false)
  }

  const elegirHora = (hora: string) => {
    const [h, m] = hora.split(':').map(Number)
    const nueva = new Date(fecha ?? new Date())
    nueva.setHours(h, m, 0, 0)
    emitir(nueva)
    setAbierto(false)
  }

  return (
    <Popover.Root open={abierto} onOpenChange={setAbierto}>
      <Popover.Anchor asChild>
        <div className={cn('relative', className)}>
          <Input
            id={id}
            value={texto}
            disabled={disabled}
            inputMode="numeric"
            autoComplete="off"
            placeholder={t(conHora ? 'comunes.marcadorFechaHora' : 'comunes.marcadorFecha')}
            aria-invalid={invalido || undefined}
            aria-describedby={aria['aria-describedby']}
            className="nums pr-11"
            onFocus={() => {
              enfocado.current = true
            }}
            onBlur={() => {
              enfocado.current = false
              setTexto(fecha ? formatear(fecha, patron) : texto.trim() ? texto : '')
            }}
            onChange={(evento) => {
              const escrito = evento.target.value
              setTexto(escrito)
              if (!escrito.trim()) emitir(null)
              else {
                const interpretada = interpretar(escrito, idioma, conHora)
                if (interpretada) emitir(interpretada)
              }
            }}
          />
          <Popover.Trigger asChild>
            <button
              type="button"
              disabled={disabled}
              aria-label={t('comunes.abrirCalendario')}
              // Se pide en cuanto alguien va a abrirlo: casi siempre llega antes del toque.
              onPointerEnter={() => void cargarCalendario().catch(() => undefined)}
              onFocus={() => void cargarCalendario().catch(() => undefined)}
              className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-faint hover:bg-cream-200 hover:text-foreground data-[state=open]:text-primary disabled:pointer-events-none"
            >
              <CalendarDays className="size-4" aria-hidden />
            </button>
          </Popover.Trigger>
        </div>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          collisionPadding={12}
          className="flotante z-50 max-h-[calc(100dvh-24px)] w-max max-w-[calc(100vw-24px)] origin-(--radix-popover-content-transform-origin) overflow-y-auto rounded-(--radius-card) border p-3 data-[state=open]:animate-(--animate-pop-in) data-[state=closed]:animate-(--animate-pop-out)"
        >
          <div className="flex flex-col gap-3 min-[480px]:flex-row">
            <Suspense fallback={<EsperaCalendario />}>
              <CalendarioFecha fecha={fecha} idioma={idioma} onElegir={elegirDia} />
            </Suspense>
            {conHora && (
              <div className="min-w-0 min-[480px]:w-24">
                <p className="mb-1.5 px-1 text-[11px] font-medium uppercase tracking-wide text-faint">{t('comunes.hora')}</p>
                <div
                  ref={listaHoras}
                  role="group"
                  aria-label={t('comunes.hora')}
                  className="flex gap-1 overflow-x-auto pb-1 min-[480px]:h-[268px] min-[480px]:flex-col min-[480px]:overflow-y-auto min-[480px]:overflow-x-visible min-[480px]:pr-1"
                >
                  {HORARIOS.map((hora) => (
                    <button
                      key={hora}
                      type="button"
                      aria-pressed={hora === horaActual}
                      onClick={() => elegirHora(hora)}
                      className={cn(
                        'nums shrink-0 cursor-pointer rounded-lg px-3 py-2 text-[13px]',
                        hora === horaActual ? 'bg-primary font-semibold text-on-primary' : 'text-muted hover:bg-cream-200 hover:text-foreground',
                      )}
                    >
                      {hora}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
            <button
              type="button"
              onClick={() => {
                const ahora = new Date()
                ahora.setSeconds(0, 0)
                emitir(ahora)
                setAbierto(false)
              }}
              className="cursor-pointer rounded-lg px-3 py-1.5 text-[13px] font-medium text-primary hover:bg-primary-tint"
            >
              {t('comunes.hoy')}
            </button>
            <button
              type="button"
              onClick={() => {
                emitir(null)
                setTexto('')
                setAbierto(false)
              }}
              className="cursor-pointer rounded-lg px-3 py-1.5 text-[13px] font-medium text-muted hover:bg-cream-200 hover:text-foreground"
            >
              {t('comunes.limpiar')}
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
