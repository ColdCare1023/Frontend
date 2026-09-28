import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, RotateCcw, Save, ShieldCheck } from 'lucide-react'

import { useChecklistBPA } from '@/application/hooks/useChecklistBPA'
import {
  ITEMS_CHECKLIST_BPA,
  claveTraduccion,
  type ItemChecklistBPA,
  type ItemsChecklistBPA,
} from '@/domain/entities/ChecklistBPA'
import { cn } from '@/lib/utils'
import { fechaISOlocal } from '@/lib/formato'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'

const VACIO: ItemsChecklistBPA = Object.fromEntries(
  ITEMS_CHECKLIST_BPA.map((item) => [item, false]),
) as ItemsChecklistBPA

export function ChecklistBPAPage() {
  const { t, i18n } = useTranslation()
  const { checklist, cargando, guardando, errorCarga, errorGuardado, guardar } = useChecklistBPA()

  const [estado, setEstado] = useState<ItemsChecklistBPA>(VACIO)
  const [observaciones, setObservaciones] = useState('')
  const [guardadoOk, setGuardadoOk] = useState(false)

  // Al llegar el checklist del día, el formulario se rehidrata con lo ya
  // declarado para que corregir un ítem no obligue a marcar los diez de nuevo.
  useEffect(() => {
    if (!checklist) return
    setEstado(
      Object.fromEntries(
        ITEMS_CHECKLIST_BPA.map((item) => [item, checklist[item]]),
      ) as ItemsChecklistBPA,
    )
    setObservaciones(checklist.observaciones ?? '')
  }, [checklist])

  const hechos = useMemo(
    () => ITEMS_CHECKLIST_BPA.filter((item) => estado[item]).length,
    [estado],
  )
  const progreso = (hechos / ITEMS_CHECKLIST_BPA.length) * 100
  const completo = hechos === ITEMS_CHECKLIST_BPA.length

  const alternar = (item: ItemChecklistBPA) => {
    setEstado((previo) => ({ ...previo, [item]: !previo[item] }))
    setGuardadoOk(false)
  }

  const onGuardar = async () => {
    const ok = await guardar({ fecha: fechaISOlocal(), ...estado, observaciones: observaciones || null })
    setGuardadoOk(ok)
  }

  const formatoFecha = (iso: string) =>
    new Date(iso).toLocaleString(i18n.language === 'en' ? 'en-US' : 'es-PE')

  return (
    <div className="max-w-3xl">
      <PageHeader
        eyebrow={t('nav.seccionCumplimiento')}
        titulo={t('checklist.titulo')}
        descripcion={t('checklist.descripcion')}
      >
        <Button
          variant="ghost"
          size="sm"
          disabled={guardando}
          onClick={() => {
            setEstado(VACIO)
            setObservaciones('')
            setGuardadoOk(false)
          }}
        >
          <RotateCcw />
          {t('checklist.reiniciar')}
        </Button>
      </PageHeader>

      {/* ── Progreso ────────────────────────────────────────── */}
      <Card className="mb-5 animate-rise">
        <CardContent className="p-5">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium">
              {t('checklist.progreso', { hechos, total: ITEMS_CHECKLIST_BPA.length })}
            </p>
            <div className="flex items-center gap-2">
              {checklist && (
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-medium',
                    checklist.conforme
                      ? 'bg-success-100 text-success-700'
                      : 'bg-clay-100 text-clay-700',
                  )}
                >
                  {checklist.conforme ? t('checklist.conforme') : t('checklist.conObservaciones')}
                </span>
              )}
              <p className="nums text-sm text-muted">{progreso.toFixed(0)}%</p>
            </div>
          </div>
          <div
            role="progressbar"
            aria-label={t('checklist.progreso', { hechos, total: ITEMS_CHECKLIST_BPA.length })}
            aria-valuenow={hechos}
            aria-valuemin={0}
            aria-valuemax={ITEMS_CHECKLIST_BPA.length}
            className="h-2 overflow-hidden rounded-full bg-cream-200"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
              style={{ width: `${progreso}%` }}
            />
          </div>

          <p className="mt-3 text-xs text-faint">
            {cargando
              ? t('checklist.cargando')
              : checklist
                ? t('checklist.ultimaActualizacion', {
                    fecha: formatoFecha(checklist.updated_at),
                  })
                : t('checklist.sinRegistrarHoy')}
          </p>
        </CardContent>
      </Card>

      {/* ── Ítems ───────────────────────────────────────────── */}
      <ul className="space-y-2">
        {ITEMS_CHECKLIST_BPA.map((item, indice) => {
          const marcado = estado[item]
          return (
            <li key={item} className="animate-rise" style={{ animationDelay: `${indice * 35}ms` }}>
              <button
                type="button"
                onClick={() => alternar(item)}
                aria-pressed={marcado}
                disabled={cargando}
                className={cn(
                  'flex w-full cursor-pointer items-center gap-3 rounded-(--radius-card) border p-4 text-left transition-colors duration-150 disabled:cursor-wait disabled:opacity-60',
                  marcado
                    ? 'border-pine-200 bg-pine-100/50'
                    : 'border-border bg-surface hover:border-border-strong',
                )}
              >
                <span
                  className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors duration-150',
                    marcado
                      ? 'border-primary bg-primary text-cream-50'
                      : 'border-border-strong bg-surface',
                  )}
                  aria-hidden
                >
                  {marcado && <Check className="size-3.5" strokeWidth={3} />}
                </span>
                <span
                  className={cn(
                    'text-sm leading-snug',
                    marcado ? 'text-success-700' : 'text-foreground',
                  )}
                >
                  {t(claveTraduccion(item))}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {/* ── Observaciones ───────────────────────────────────── */}
      <div className="mt-5 animate-rise">
        <label
          htmlFor="checklist-observaciones"
          className="mb-1.5 block text-[13px] font-medium text-foreground"
        >
          {t('checklist.observaciones')}
        </label>
        <textarea
          id="checklist-observaciones"
          rows={3}
          maxLength={2000}
          value={observaciones}
          disabled={cargando}
          onChange={(e) => {
            setObservaciones(e.target.value)
            setGuardadoOk(false)
          }}
          placeholder={t('checklist.observacionesPlaceholder')}
          className="w-full resize-y rounded-(--radius-field) border border-border-field bg-surface px-3 py-2 text-sm leading-relaxed text-foreground outline-none transition-colors placeholder:text-faint focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
        />
      </div>

      {/* ── Guardar ─────────────────────────────────────────── */}
      {/* Un ítem sin marcar es una declaración de NO conformidad, no un campo a
          medio llenar: es justo el hallazgo que hay que poder registrar. Por eso
          el guardado nunca se bloquea — solo se advierte de que la verificación
          quedará marcada como "con observaciones". */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button disabled={guardando || cargando} onClick={() => void onGuardar()}>
          <Save />
          {guardando ? t('checklist.guardando') : t('checklist.guardar')}
        </Button>
        {!completo && !cargando && (
          <p className="text-xs text-muted">
            {t('checklist.avisoNoConforme', {
              faltantes: ITEMS_CHECKLIST_BPA.length - hechos,
            })}
          </p>
        )}
      </div>

      {guardadoOk && (
        <p
          role="status"
          className="mt-3 flex items-center gap-2 rounded-(--radius-field) bg-success-100 px-3 py-2 text-[13px] text-success-700"
        >
          <ShieldCheck className="size-4 shrink-0" />
          {t('checklist.guardado')}
        </p>
      )}
      {errorGuardado && (
        <p
          role="alert"
          className="mt-3 rounded-(--radius-field) bg-clay-100 px-3 py-2 text-[13px] text-clay-700"
        >
          {t('checklist.errorGuardar')}
        </p>
      )}
      {errorCarga && (
        <p
          role="alert"
          className="mt-3 rounded-(--radius-field) bg-clay-100 px-3 py-2 text-[13px] text-clay-700"
        >
          {t('checklist.errorCargar')}
        </p>
      )}

      <p className="mt-5 text-xs leading-relaxed text-faint">{t('checklist.nota')}</p>
    </div>
  )
}
