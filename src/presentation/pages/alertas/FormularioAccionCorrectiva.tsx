import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'

import type { ResultadoAccionAlerta } from '@/application/hooks/useAlertas'
import { Button } from '../../components/ui/button'
import { CambioTexto } from '../../components/ui/cambio-texto'
import { Label, Textarea } from '../../components/ui/input'
import { SidePanelBody, SidePanelFooter } from '../../components/ui/side-panel'
import { MAX_CAMPO_ACCION, type BorradorAccion } from './tipos'

const CAMPOS = ['decision', 'descripcion', 'justificacion'] as const
type Campo = (typeof CAMPOS)[number]

const ETIQUETA: Record<Campo, string> = {
  decision: 'alertas.etiquetaDecision',
  descripcion: 'alertas.etiquetaAccion',
  justificacion: 'alertas.etiquetaJustificacion',
}
const MARCADOR: Record<Campo, string> = {
  decision: 'alertas.decisionPlaceholder',
  descripcion: 'alertas.descripcionAccionPlaceholder',
  justificacion: 'alertas.justificacionPlaceholder',
}
const ID: Record<Campo, string> = {
  decision: 'accion-decision',
  descripcion: 'accion-descripcion',
  justificacion: 'accion-justificacion',
}
/** El contador aparece cerca del límite y solo se anuncia muy cerca. */
const MOSTRAR_CONTADOR = 1800
const ANUNCIAR_CONTADOR = 1950

type Estado = 'editando' | 'guardando' | 'registrada'

/**
 * HU-27: decisión, acción y justificación, las tres obligatorias, en el orden
 * de la historia. El borrador vive en la página (por alerta, solo en memoria):
 * cerrar con Esc o la X lo conserva; Cancelar lo descarta. Guardar queda
 * `aria-disabled` (enfocable) y explica qué falta. Ctrl/⌘ + Enter guarda.
 */
export function FormularioAccionCorrectiva({
  borrador,
  onBorrador,
  onGuardar,
  onCancelar,
  onRegistrada,
  onVerCronologia,
}: {
  borrador: BorradorAccion
  onBorrador: (borrador: BorradorAccion) => void
  onGuardar: (datos: BorradorAccion) => Promise<ResultadoAccionAlerta>
  onCancelar: () => void
  /** Tras el éxito: el panel pasa a la cronología sin cerrarse (WCAG 2.2.1). */
  onRegistrada: () => void
  onVerCronologia: () => void
}) {
  const { t } = useTranslation()
  const idFaltan = useId()
  const [estado, setEstado] = useState<Estado>('editando')
  const [error, setError] = useState<'conflicto' | 'error' | null>(null)
  const enviando = useRef(false)

  const faltan = CAMPOS.filter((campo) => borrador[campo].trim().length === 0)
  const completo = faltan.length === 0
  const bloqueado = !completo || estado !== 'editando'

  const guardar = async () => {
    if (bloqueado || enviando.current) return
    enviando.current = true
    setEstado('guardando')
    setError(null)
    try {
      const resultado = await onGuardar({
        decision: borrador.decision.trim(),
        descripcion: borrador.descripcion.trim(),
        justificacion: borrador.justificacion.trim(),
      })
      if (resultado === 'ok') {
        setEstado('registrada')
        onRegistrada()
      } else {
        // El borrador se conserva en ambos casos: no se pierde lo escrito.
        setError(resultado)
        setEstado('editando')
      }
    } finally {
      enviando.current = false
    }
  }

  const textoBoton =
    estado === 'registrada' ? t('alertas.panel.registrada') : estado === 'guardando' ? t('alertas.guardando') : t('alertas.guardarAccion')

  return (
    <>
      <SidePanelBody
        className="space-y-4 px-4 py-4 sm:px-6 sm:py-5"
        onKeyDown={(evento) => {
          if (evento.key === 'Enter' && (evento.ctrlKey || evento.metaKey)) {
            evento.preventDefault()
            void guardar()
          }
        }}
      >
        <p className="text-meta text-muted">{t('alertas.panel.camposObligatorios')}</p>
        {CAMPOS.map((campo) => {
          const valor = borrador[campo]
          const idAyuda = `${ID[campo]}-ayuda`
          const idContador = `${ID[campo]}-contador`
          const conContador = valor.length >= MOSTRAR_CONTADOR
          const descrito = [campo === 'descripcion' ? idAyuda : null, conContador ? idContador : null].filter(Boolean).join(' ')
          return (
            <div key={campo}>
              <Label htmlFor={ID[campo]}>{t(ETIQUETA[campo])}</Label>
              <Textarea
                id={ID[campo]}
                value={valor}
                onChange={(e) => {
                  setError(null)
                  onBorrador({ ...borrador, [campo]: e.target.value })
                }}
                placeholder={t(MARCADOR[campo])}
                maxLength={MAX_CAMPO_ACCION}
                rows={campo === 'descripcion' ? 3 : 2}
                aria-required="true"
                aria-describedby={descrito || undefined}
                readOnly={estado !== 'editando'}
              />
              {campo === 'descripcion' && (
                <p id={idAyuda} className="mt-1 text-meta text-faint">
                  {t('alertas.descripcionAccionAyuda')}
                </p>
              )}
              {conContador && (
                <p
                  id={idContador}
                  aria-live={valor.length >= ANUNCIAR_CONTADOR ? 'polite' : 'off'}
                  className="nums mt-1 text-right text-meta text-faint"
                >
                  {t('alertas.panel.contador', { actual: valor.length, max: MAX_CAMPO_ACCION })}
                </p>
              )}
            </div>
          )
        })}
        {error === 'conflicto' && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-(--radius-field) bg-critical-tint px-3 py-2 text-body text-critical">
            <p className="min-w-0 flex-1">{t('alertas.conflictoEstado')}</p>
            <Button size="sm" variant="secondary" onClick={onVerCronologia}>
              {t('alertas.panel.verCronologia')}
            </Button>
          </div>
        )}
        {error === 'error' && (
          <p role="alert" className="rounded-(--radius-field) bg-critical-tint px-3 py-2 text-body text-critical">
            {t('alertas.panel.errorGuardar')}
          </p>
        )}
      </SidePanelBody>
      <SidePanelFooter className="items-stretch px-4 sm:items-center sm:px-6">
        <p id={idFaltan} className="mr-auto self-center text-meta text-faint max-sm:hidden">
          {completo ? (
            <span className="pointer-coarse:hidden">{t('alertas.panel.atajo')}</span>
          ) : (
            t('alertas.panel.faltan', { campos: faltan.map((c) => t(ETIQUETA[c]).toLowerCase()).join(', ') })
          )}
        </p>
        <Button variant="ghost" onClick={onCancelar} disabled={estado === 'guardando'}>
          {t('comunes.cancelar')}
        </Button>
        <Button
          className="min-w-36 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
          aria-disabled={bloqueado || undefined}
          aria-describedby={completo ? undefined : idFaltan}
          aria-keyshortcuts="Control+Enter Meta+Enter"
          onClick={() => void guardar()}
        >
          <CambioTexto texto={textoBoton} icono={estado === 'registrada' ? <Check aria-hidden /> : undefined} />
        </Button>
      </SidePanelFooter>
    </>
  )
}
