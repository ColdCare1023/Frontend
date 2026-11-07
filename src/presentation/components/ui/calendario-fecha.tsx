import { DayPicker } from 'react-day-picker'
import { enUS, es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * El calendario de `SelectorFecha`. Vive aparte porque pesa (react-day-picker y los
 * idiomas de date-fns): solo se descarga cuando alguien va a abrir el selector.
 */
export default function CalendarioFecha({
  fecha,
  idioma,
  onElegir,
}: {
  fecha: Date | null
  idioma: 'es' | 'en'
  onElegir: (dia: Date | undefined) => void
}) {
  return (
    <DayPicker
      mode="single"
      selected={fecha ?? undefined}
      onSelect={onElegir}
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
        button_previous: 'flex size-9 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-cream-200 hover:text-foreground',
        button_next: 'flex size-9 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-cream-200 hover:text-foreground',
        month_grid: 'mt-2 border-collapse',
        weekday: 'size-9 text-[11px] font-medium uppercase text-faint',
        day: 'p-0.5 text-center',
        day_button:
          'nums size-9 cursor-pointer rounded-lg text-[13px] transition-transform duration-(--duration-micro) hover:bg-cream-200 active:scale-95 focus-visible:outline-2 focus-visible:outline-ring',
        selected: '[&>button]:bg-primary [&>button]:font-semibold [&>button]:text-on-primary [&>button]:hover:bg-primary-hover',
        today: '[&>button]:font-semibold [&>button]:ring-1 [&>button]:ring-inset [&>button]:ring-primary/45',
        outside: 'text-faint/60',
        disabled: 'pointer-events-none opacity-35',
      }}
    />
  )
}
