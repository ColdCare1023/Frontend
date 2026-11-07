import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LayoutGroup, motion, useReducedMotion, type Transition } from 'motion/react'
import { Ban, Check, ChevronDown, Lock, X } from 'lucide-react'

import type { RegistroAuditoria } from '@/domain/entities/Usuario'
import { fechaHora } from '@/lib/formato'
import { Badge } from '@/presentation/components/ui/badge'
import { agruparPorDia, horaCorta, resumirDias, rotuloDia, type ResumenDia } from './dias'
import './linea-tiempo.css'

const CARACTERES_USUARIO = 8

/** Las filas de abajo se corren con un resorte corto, sin rebote: solo `transform`. */
const MUELLE: Transition = { type: 'spring', stiffness: 520, damping: 44, mass: 0.8 }

/** El resultado se lee sin buscarlo: palabra e icono siempre, y color solo si no fue exitoso. */
function Resultado({ valor }: { valor: string | null | undefined }) {
  const { t } = useTranslation()
  if (!valor) return <Badge variant="outline">—</Badge>
  const texto = t(`auditoria.resultados.${valor}`, { defaultValue: valor })
  if (valor === 'exitoso') {
    return (
      <span className="inline-flex items-center gap-1 text-[13px] leading-5 font-medium text-success-700 capitalize">
        <Check aria-hidden className="size-3.5 shrink-0" strokeWidth={2.5} />
        {texto}
      </span>
    )
  }
  if (valor === 'bloqueado') {
    return (
      <Badge variant="warn" className="capitalize">
        <Lock aria-hidden className="size-3 shrink-0" />
        {texto}
      </Badge>
    )
  }
  if (valor === 'fallido') {
    return (
      <Badge variant="critical" className="capitalize">
        <X aria-hidden className="size-3 shrink-0" strokeWidth={3} />
        {texto}
      </Badge>
    )
  }
  if (valor === 'denegado') {
    return (
      <Badge variant="outline" className="text-critical capitalize ring-critical/60">
        <Ban aria-hidden className="size-3 shrink-0" />
        {texto}
      </Badge>
    )
  }
  return <Badge variant="neutral" className="capitalize">{texto}</Badge>
}

function horaDe(iso: string) {
  return Number.isNaN(Date.parse(iso)) ? '—' : horaCorta(iso)
}

function usuarioCorto(id: string) {
  return id.length > CARACTERES_USUARIO ? `${id.slice(0, CARACTERES_USUARIO)}…` : id
}

/** Lo que pasó, en palabras: «Generó un reporte», no `REPORTE_BPA_GENERADO`. */
function nombreAccion(accion: string, t: ReturnType<typeof useTranslation>['t']) {
  return t(`auditoria.eventos.${accion}`, {
    defaultValue: accion
      .toLocaleLowerCase()
      .replaceAll('_', ' ')
      .replace(/^\p{L}/u, (letra) => letra.toLocaleUpperCase()),
  })
}

function CabeceraDia({ clave, resumen, layout }: { clave: string; resumen: ResumenDia | undefined; layout: boolean }) {
  const { t } = useTranslation()
  const { principal, secundario } = rotuloDia(clave, { hoy: t('comunes.hoy'), ayer: t('auditoria.ayer') })
  return (
    <motion.tr role="row" layout={layout ? 'position' : false} transition={MUELLE} className="linea-auditoria__fecha">
      <th role="rowheader" scope="rowgroup" colSpan={8}>
        <span className="linea-auditoria__dia-nombre">{principal}</span>
        {secundario && <span className="linea-auditoria__dia-fecha">{secundario}</span>}
        {resumen && (
          <span className="linea-auditoria__dia-cuenta">
            {t('auditoria.accionesDia', { count: resumen.total })}
            {resumen.noExitosas > 0 && ` · ${t('auditoria.noExitosasDia', { count: resumen.noExitosas })}`}
          </span>
        )}
      </th>
    </motion.tr>
  )
}

/**
 * Una acción: hora, qué se hizo y quién, y su resultado. Lo técnico (usuario, recurso, IP, código)
 * sigue en la fila para el lector de pantalla, y a la vista solo tras «Ver detalle»: la fila crece
 * hasta ser su ficha y las de abajo se corren.
 */
function FilaAccion({
  registro,
  quien,
  layout,
}: {
  registro: RegistroAuditoria
  quien: string
  layout: boolean
}) {
  const { t } = useTranslation()
  const [abierta, setAbierta] = useState(false)
  const bloqueo = registro.accion === 'BLOQUEO_TEMPORAL' || registro.resultado === 'bloqueado'
  const accion = nombreAccion(registro.accion, t)
  const hora = horaDe(registro.created_at)
  const texto = abierta ? t('auditoria.ocultarDetalle') : t('auditoria.verDetalle')
  return (
    <motion.tr
      role="row"
      layout={layout ? 'position' : false}
      transition={MUELLE}
      className="linea-auditoria__fila"
      data-abierta={abierta || undefined}
      data-resultado={registro.resultado ?? undefined}
      data-bloqueo={bloqueo || undefined}
    >
      <td role="cell" className="linea-auditoria__hora">
        <time dateTime={registro.created_at}>{hora}</time>
        {bloqueo && <span aria-hidden className="linea-auditoria__velo" />}
        {abierta && <span aria-hidden className="linea-auditoria__placa" />}
      </td>
      <td role="cell" className="linea-auditoria__accion">
        <span className="linea-auditoria__verbo">{accion}</span>
        <span className="linea-auditoria__quien">{quien}</span>
      </td>
      <td role="cell" className="linea-auditoria__resultado">
        <Resultado valor={registro.resultado} />
      </td>
      <td role="cell" data-label={t('auditoria.usuarioId')} className="linea-auditoria__tecnico linea-auditoria__usuario">
        {registro.usuario_id ?? '—'}
      </td>
      <td role="cell" data-label={t('auditoria.recurso')} className="linea-auditoria__tecnico linea-auditoria__recurso">
        {registro.recurso}
      </td>
      <td role="cell" data-label={t('auditoria.ip')} className="linea-auditoria__tecnico linea-auditoria__ip">
        {registro.ip_origen ?? '—'}
      </td>
      <td role="cell" data-label={t('auditoria.codigo')} className="linea-auditoria__tecnico linea-auditoria__codigo">
        {registro.accion}
        <span className="linea-auditoria__exacta">{fechaHora(registro.created_at)}</span>
      </td>
      <td role="cell" className="linea-auditoria__abrir">
        <button
          type="button"
          aria-expanded={abierta}
          aria-label={`${texto}: ${accion}, ${hora}`}
          onClick={() => setAbierta((previo) => !previo)}
          className="linea-auditoria__boton realce"
        >
          <span>{texto}</span>
          <ChevronDown aria-hidden className="linea-auditoria__chevron" />
        </button>
      </td>
    </motion.tr>
  )
}

export function LineaTiempo({
  todos,
  visibles,
  cargando,
  quienHizo,
}: {
  /** La lista completa, para contar cada día aunque se parta entre páginas. */
  todos: RegistroAuditoria[]
  visibles: RegistroAuditoria[]
  cargando: boolean
  /** Nombre de quien hizo la acción, si se conoce. */
  quienHizo: (usuarioId: string | null) => string | null
}) {
  const { t } = useTranslation()
  const reducir = useReducedMotion()
  const dias = useMemo(() => agruparPorDia(visibles), [visibles])
  const resumen = useMemo(() => resumirDias(todos), [todos])
  const quien = (id: string | null) =>
    quienHizo(id) ?? (id ? t('auditoria.quienCodigo', { id: usuarioCorto(id) }) : t('auditoria.quienSinUsuario'))

  return (
    <div role="region" aria-label={t('auditoria.bitacora')} aria-busy={cargando || undefined} className="linea-auditoria">
      <LayoutGroup>
        <table role="table" className="linea-auditoria__tabla">
          <caption className="sr-only">{t('auditoria.bitacora')}</caption>
          <thead role="rowgroup" className="linea-auditoria__cabeza">
            <tr role="row">
              <th role="columnheader" scope="col">{t('comunes.hora')}</th>
              <th role="columnheader" scope="col">{t('auditoria.accion')}</th>
              <th role="columnheader" scope="col">{t('auditoria.resultado')}</th>
              <th role="columnheader" scope="col">{t('auditoria.usuarioId')}</th>
              <th role="columnheader" scope="col">{t('auditoria.recurso')}</th>
              <th role="columnheader" scope="col">{t('auditoria.ip')}</th>
              <th role="columnheader" scope="col">{t('auditoria.codigo')}</th>
              <th role="columnheader" scope="col">{t('auditoria.detalle')}</th>
            </tr>
          </thead>
          {dias.map((dia) => (
            <tbody key={dia.clave} role="rowgroup" className="linea-auditoria__dia">
              <CabeceraDia clave={dia.clave} resumen={resumen.get(dia.clave)} layout={!reducir} />
              {dia.registros.map((registro) => (
                <FilaAccion key={registro.id} registro={registro} quien={quien(registro.usuario_id)} layout={!reducir} />
              ))}
            </tbody>
          ))}
        </table>
      </LayoutGroup>
    </div>
  )
}

/** La forma de la línea mientras carga: un día y sus renglones. */
export function EsqueletoLinea() {
  const { t } = useTranslation()
  return (
    <div role="status">
      <span className="sr-only">{t('app.cargando')}</span>
      <div aria-hidden>
        <div className="flex items-baseline gap-3 border-b-2 border-border-strong pb-2">
          <div className="esqueleto h-8 w-24 rounded" />
          <div className="esqueleto h-3.5 w-36 rounded" />
        </div>
        {[62, 48, 70, 54, 40].map((ancho) => (
          <div key={ancho} className="flex items-center gap-3 border-b border-border py-4">
            <div className="esqueleto size-2.5 shrink-0 rounded-full" />
            <div className="esqueleto h-3.5 rounded" style={{ width: `${ancho}%` }} />
            <div className="esqueleto ml-auto h-3.5 w-16 shrink-0 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
