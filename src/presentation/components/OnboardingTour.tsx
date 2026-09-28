import { useEffect, useMemo, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useTranslation } from 'react-i18next'
import type { Rol } from '@/domain/value-objects/Rol'
import { useAuthStore } from '@/application/stores/authStore'

const STORAGE_KEY = 'cf_onboarding_seen_v1'
export const REOPEN_TOUR_EVENT = 'cf:reopen-onboarding'

function wasSeen(key: string): boolean {
  try { return localStorage.getItem(key) === 'true' } catch { return false }
}

function rememberSeen(key: string): void {
  try { localStorage.setItem(key, 'true') } catch { /* Preferencia opcional: almacenamiento bloqueado. */ }
}

const STEPS = [
  { route: '/dashboard', title: ['Monitoreo', 'Monitoring'], detail: ['Consulta la temperatura junto al medicamento, el estado térmico y la conexión en tiempo real.', 'Check medicine temperature, thermal status, and connection in real time.'], roles: ['farmaceutico', 'tecnico', 'auditor', 'administrador'] },
  { route: '/alertas', title: ['Alertas', 'Alerts'], detail: ['Distingue riesgo preventivo de excursión crítica y registra las acciones tomadas.', 'Distinguish preventive risk from critical excursion and record actions taken.'], roles: ['farmaceutico', 'tecnico', 'auditor', 'administrador'] },
  { route: '/historial', title: ['Historial', 'History'], detail: ['Filtra mediciones para reconstruir cuándo ocurrió un cambio térmico.', 'Filter readings to reconstruct when a thermal change occurred.'], roles: ['farmaceutico', 'tecnico', 'auditor', 'administrador'] },
  { route: '/trazabilidad', title: ['Trazabilidad', 'Traceability'], detail: ['Verifica la integridad de los registros encadenados.', 'Verify integrity of chained records.'], roles: ['farmaceutico', 'tecnico', 'auditor', 'administrador'] },
  { route: '/reportes', title: ['Reportes', 'Reports'], detail: ['Genera evidencia del periodo cuando la necesites.', 'Generate period evidence when needed.'], roles: ['farmaceutico', 'auditor', 'administrador'] },
  { route: '/checklist-bpa', title: ['Checklist BPA', 'BPA checklist'], detail: ['Completa la verificación diaria y guarda constancia.', 'Complete the daily check and save evidence.'], roles: ['farmaceutico', 'administrador'] },
] as const

type Rect = { top: number; left: number; width: number; height: number }

export function OnboardingTour({ rol, userId }: { rol: Rol; userId: string }) {
  const { i18n } = useTranslation()
  const requiresPrivacy = useAuthStore((state) => state.requierePrivacidad)
  const en = i18n.language.startsWith('en')
  const steps = useMemo(() => STEPS.filter((step) => (step.roles as readonly string[]).includes(rol)), [rol])
  const storageKey = `${STORAGE_KEY}:${userId}`
  const [open, setOpen] = useState(() => !wasSeen(storageKey))
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)

  useEffect(() => {
    const reopen = () => { setIndex(0); setOpen(true) }
    window.addEventListener(REOPEN_TOUR_EVENT, reopen)
    return () => window.removeEventListener(REOPEN_TOUR_EVENT, reopen)
  }, [])

  useEffect(() => {
    if (!open || requiresPrivacy || !steps[index]) return
    const update = () => {
      const mobile = window.matchMedia('(max-width: 1023px)').matches
      const target = document.querySelector<HTMLElement>(
        mobile ? '[data-tour-mobile-menu]' : `aside [data-tour-route="${steps[index].route}"]`,
      )
      const box = target?.getBoundingClientRect()
      setRect(box ? { top: Math.max(0, box.top - 5), left: Math.max(0, box.left - 5), width: box.width + 10, height: box.height + 10 } : null)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [open, requiresPrivacy, index, steps])

  const finish = () => {
    rememberSeen(storageKey)
    setOpen(false)
  }

  if (!steps.length) return null
  const step = steps[index]
  const shade = 'fixed bg-ink-900/60 motion-reduce:transition-none'

  return (
    <Dialog.Root open={open && !requiresPrivacy} onOpenChange={(next) => { if (!next) finish() }}>
      <Dialog.Portal>
        {rect ? <>
          <div className={shade} style={{ zIndex: 70, top: 0, left: 0, right: 0, height: rect.top }} />
          <div className={shade} style={{ zIndex: 70, top: rect.top, left: 0, width: rect.left, height: rect.height }} />
          <div className={shade} style={{ zIndex: 70, top: rect.top, left: rect.left + rect.width, right: 0, height: rect.height }} />
          <div className={shade} style={{ zIndex: 70, top: rect.top + rect.height, left: 0, right: 0, bottom: 0 }} />
          <div className="pointer-events-none fixed rounded-lg border-2 border-honey-500 shadow-[0_0_0_3px_rgba(255,255,255,0.85)]" style={{ zIndex: 71, ...rect }} />
        </> : <div className={`${shade} inset-0`} style={{ zIndex: 70 }} />}
        <Dialog.Content
          aria-describedby="tour-description"
          onInteractOutside={(event) => event.preventDefault()}
          className="fixed inset-x-4 bottom-4 z-[72] mx-auto max-w-sm rounded-xl border border-border bg-surface p-5 shadow-(--shadow-raised) focus:outline-none motion-safe:animate-rise sm:inset-x-auto sm:bottom-8 sm:right-8"
        >
          <p className="eyebrow mb-2">{en ? 'Quick tour' : 'Recorrido inicial'} · {index + 1}/{steps.length}</p>
          {index === 0 && <p className="mb-2 text-sm font-medium text-pine-700">{en ? 'Welcome to ColdCare monitoring' : 'Te damos la bienvenida a ColdCare'}</p>}
          <Dialog.Title className="font-display text-xl font-semibold text-foreground">{step.title[en ? 1 : 0]}</Dialog.Title>
          <Dialog.Description id="tour-description" className="mt-2 text-sm leading-relaxed text-muted">{step.detail[en ? 1 : 0]}</Dialog.Description>
          <p className="mt-2 text-xs text-faint lg:hidden">{en ? 'Find this section in the menu after closing the tour.' : 'Encuentra esta sección en el menú al cerrar el recorrido.'}</p>
          <div className="mt-5 flex items-center gap-2">
            <button type="button" onClick={finish} className="mr-auto min-h-11 rounded-md px-2 py-2 text-sm text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{en ? 'Skip' : 'Omitir'}</button>
            {index > 0 && <button type="button" onClick={() => setIndex(index - 1)} className="min-h-11 rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-cream-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{en ? 'Back' : 'Atrás'}</button>}
            <button type="button" onClick={() => index === steps.length - 1 ? finish() : setIndex(index + 1)} className="min-h-11 rounded-md bg-primary px-4 py-2 text-sm font-medium text-cream-50 hover:bg-pine-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{index === steps.length - 1 ? (en ? 'Finish' : 'Finalizar') : (en ? 'Next' : 'Siguiente')}</button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
