import { useEffect, useMemo, useRef, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { DayPicker } from 'react-day-picker'
import { format, isValid, parse } from 'date-fns'
import { enUS, es } from 'date-fns/locale'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import { Input } from './input'

/**
 * Selector de fecha (y hora) adaptado de shadcn-datetime-picker
 * (github.com/Maliksidk19/shadcn-datetime-picker, MIT): calendario y lista de
 * horas lado a lado en un popover de cristal. Diferencias para ColdCare:
 * - el campo admite escritura (teclado, pegar) además del calendario;
 * - no bloquea horas pasadas: los filtros consultan el pasado;
 * - mismo contrato que el input nativo: `yyyy-MM-dd` o `yyyy-MM-ddTHH:mm`.
 */
const ISO_FECHA = 'yyyy-MM-dd'
const ISO_FECHA_HORA = "yyyy-MM-dd'T'HH:mm"
const PASO_MINUTOS = 30

function patronVisible(idioma: 'es' | 'en', conHora: boolean) {
  const fecha = idioma === 'en' ? 'MM/dd/yyyy' : 'dd/MM/yyyy'
  return conHora ? `${fecha} HH:mm` : fecha
}

/** Interpreta texto exacto (ISO o el formato visible); nada parcial. */
function interpretar(texto: string, idioma: 'es' | 'en', conHora: boolean): Date | null {
  const limpio = texto.trim()
  if (!limpio) return null
  for (const patron of [conHora ? ISO_FECHA_HORA : ISO_FECHA, patronVisible(idioma, conHora)]) {
    const fecha = parse(limpio, patron, new Date())
    if (isValid(fecha) && format(fecha, patron) === limpio) return fecha
  }
  return null
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
  const [texto, setTexto] = useState(() => (fecha ? format(fecha, patron) : ''))
  const [abierto, setAbierto] = useState(false)
  const enfocado = useRef(false)
  const listaHoras = useRef<HTMLDivElement>(null)
  const horaActual = fecha ? format(fecha, 'HH:mm') : null

  // El valor externo manda, salvo mientras la persona está escribiendo.
  useEffect(() => {
    if (!enfocado.current) setTexto(fecha ? format(fecha, patron) : '')
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

  const emitir = (nueva: Date | null) => onCambiar(nueva ? format(nueva, conHora ? ISO_FECHA_HORA : ISO_FECHA) : '')

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
              setTexto(fecha ? format(fecha, patron) : texto.trim() ? texto : '')
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
              className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-faint transition-colors duration-(--duration-micro) hover:bg-cream-200/70 hover:text-foreground data-[state=open]:text-primary disabled:pointer-events-none"
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
          className="cristal z-50 w-max max-w-[calc(100vw-24px)] origin-(--radix-popover-content-transform-origin) rounded-2xl border p-3 data-[state=open]:animate-(--animate-pop-in) data-[state=closed]:animate-(--animate-pop-out)"
        >
          <div className="flex flex-col gap-3 min-[480px]:flex-row">
            <DayPicker
              mode="single"
              selected={fecha ?? undefined}
              onSelect={elegirDia}
              defaultMonth={fecha ?? new Date()}
              locale={idioma === 'en' ? enUS : es}
              weekStartsOn={1}
              showOutsideDays
              fixedWeeks
              components={{
                Chevron: ({ orientation }) =>
                  orientation === 'left' ? <ChevronLeft className="size-4" aria-hidden /> : <ChevronRight className="size-4" aria-hidden />,
              }}
              classNames={{
                root: 'text-sm text-foreground',
                months: 'relative',
                month_caption: 'flex h-9 items-center justify-center',
                caption_label: 'text-sm font-semibold capitalize',
                nav: 'absolute inset-x-0 top-0 z-10 flex h-9 items-center justify-between',
                button_previous: 'flex size-9 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors hover:bg-cream-200/70 hover:text-foreground',
                button_next: 'flex size-9 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors hover:bg-cream-200/70 hover:text-foreground',
                month_grid: 'mt-2 border-collapse',
                weekday: 'size-9 text-[11px] font-medium uppercase text-faint',
                day: 'p-0.5 text-center',
                day_button:
                  'nums size-9 cursor-pointer rounded-lg text-[13px] transition-[background-color,color,transform] duration-(--duration-micro) hover:bg-cream-200/70 active:scale-95 focus-visible:outline-2 focus-visible:outline-ring',
                selected: '[&>button]:bg-primary [&>button]:font-semibold [&>button]:text-on-primary [&>button]:hover:bg-primary-hover',
                today: '[&>button]:font-semibold [&>button]:ring-1 [&>button]:ring-inset [&>button]:ring-primary/45',
                outside: 'text-faint/60',
                disabled: 'pointer-events-none opacity-35',
              }}
            />
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
                        'nums shrink-0 cursor-pointer rounded-lg px-3 py-2 text-[13px] transition-colors duration-(--duration-micro)',
                        hora === horaActual ? 'bg-primary font-semibold text-on-primary' : 'text-muted hover:bg-cream-200/70 hover:text-foreground',
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
              className="cursor-pointer rounded-lg px-3 py-1.5 text-[13px] font-medium text-primary transition-colors hover:bg-primary-tint"
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
              className="cursor-pointer rounded-lg px-3 py-1.5 text-[13px] font-medium text-muted transition-colors hover:bg-cream-200/70 hover:text-foreground"
            >
              {t('comunes.limpiar')}
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
