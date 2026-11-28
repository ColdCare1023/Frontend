import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Shield, ShieldAlert, ShieldCheck, ShieldHalf, ShieldQuestion } from 'lucide-react'

import type { DetalleInconsistencia, EstadoCadena, RegistroTrazabilidad, VerificacionIntegridad } from '@/domain/entities/RegistroTrazabilidad'
import { primerCaracterDistinto } from '@/lib/compararSellos'
import { fechaCorta, fechaHora, hora } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { BotonCopiar, Dato } from '../../components/registros/piezas'
import { Button } from '../../components/ui/button'
import { Detalles } from '../../components/ui/detalles'
import { etiquetaEvento } from './iconosEvento'

type Estado = 'sin_verificar' | 'integra' | 'ruptura_aislada' | 'ruptura_detectada' | 'no_concluida' | 'comprometida'

const PRESENTACION: Record<Estado, { icono: typeof Shield; color: string; borde: string }> = {
  // Sin verificar no es un estado de alarma, pero el título no va en gris:
  // se leía como texto deshabilitado. Solo el escudo queda neutro.
  sin_verificar: { icono: Shield, color: 'text-foreground', borde: 'border-l-border-strong' },
  integra: { icono: ShieldCheck, color: 'text-success-700', borde: 'border-l-success-600' },
  ruptura_aislada: { icono: ShieldHalf, color: 'text-warning-700', borde: 'border-l-warning-600' },
  ruptura_detectada: { icono: ShieldAlert, color: 'text-critical', borde: 'border-l-critical' },
  // HU-26 esc. 1: sin la clave v3 no se puede concluir; no es alarma ni «íntegra».
  no_concluida: { icono: ShieldQuestion, color: 'text-warning-700', borde: 'border-l-warning-600' },
  comprometida: { icono: ShieldAlert, color: 'text-critical', borde: 'border-l-critical' },
}

/**
 * Veredicto de la cadena (un solo foco, siempre visible al entrar). No se
 * verifica sola: `/verificar` recorre toda la cadena y tiene límite por
 * minuto. Lleva la única acción primaria de la página (H8) y, para el
 * administrador con un registro señalado, «Aislar registro corrupto».
 */
export function VeredictoCadena({
  verificacion,
  estadoCadena,
  verificando,
  registros,
  onVerificar,
  onAislar,
  onVerEnTabla,
  selectorCadena,
  error,
}: {
  verificacion: VerificacionIntegridad | null
  estadoCadena: EstadoCadena | null
  verificando: boolean
  registros: readonly RegistroTrazabilidad[]
  onVerificar: () => void
  /** Presente solo si el rol puede aislar y hay un registro señalado. */
  onAislar?: () => void
  onVerEnTabla?: () => void
  /** HU-26: selector del `chain_id` a verificar (equipos y SISTEMA). */
  selectorCadena?: ReactNode
  /** Mensaje de un intento de verificación fallido. */
  error?: string | null
}) {
  const { t } = useTranslation()
  const detalle = verificacion?.detalle_inconsistencia ?? null
  // HU-26: backends previos (y el modo demo) solo envían `integra`.
  const estado: Estado = verificacion
    ? (verificacion.estado ?? (verificacion.integra ? 'integra' : 'ruptura_detectada'))
    : estadoCadena?.cadena_comprometida
      ? 'comprometida'
      : 'sin_verificar'
  const { icono: Icono, color, borde } = PRESENTACION[estado]
  const alerta = estado === 'ruptura_detectada' || estado === 'comprometida'
  // Qué cadena se verificó y con qué mecanismo (HU-26 esc. 1 y 4).
  const cadenaVerificada = verificacion
    ? verificacion.chain_id
      ? verificacion.chain_id === 'SISTEMA'
        ? t('trazabilidad.cadena.sistema')
        : verificacion.chain_id
      : t('trazabilidad.cadena.todas')
    : null
  const versiones = verificacion?.versiones_hash ?? []
  const mecanismo = [
    versiones.some((v) => v < 3) ? t('trazabilidad.cadena.mecanismoSinClave') : null,
    versiones.some((v) => v >= 3) ? t('trazabilidad.cadena.mecanismoHmac') : null,
  ].filter(Boolean).join(' · ')
  const datosCadena = verificacion && (
    <>
      <Dato etiqueta={t('trazabilidad.cadena.verificada')}><span className="codigo">{cadenaVerificada}</span></Dato>
      {mecanismo && <Dato etiqueta={t('trazabilidad.cadena.mecanismo')}>{mecanismo}</Dato>}
    </>
  )

  const titulo = verificando
    ? t('trazabilidad.veredicto.verificandoTitulo')
    : {
        sin_verificar: t('trazabilidad.veredicto.sinVerificar'),
        integra: t('trazabilidad.cadenaIntegra'),
        ruptura_aislada: t('trazabilidad.rupturaAislada'),
        ruptura_detectada: t('trazabilidad.cadenaRota'),
        no_concluida: t('trazabilidad.noConcluida'),
        comprometida: t('trazabilidad.cadenaComprometida'),
      }[estado]

  const texto = {
    sin_verificar: t('trazabilidad.veredicto.sinVerificarDetalle'),
    integra: t('trazabilidad.cadenaIntegraDetalle', { n: verificacion?.total_registros }),
    ruptura_aislada: t('trazabilidad.rupturaAisladaDetalle', { n: verificacion?.total_rupturas ?? 1, fecha: fechaHora(verificacion?.integra_desde) }),
    ruptura_detectada: t('trazabilidad.cadenaRotaDetalle', { n: verificacion?.primer_registro_inconsistente }),
    no_concluida: t('trazabilidad.noConcluidaDetalle', { count: verificacion?.total_no_verificables ?? 0 }),
    comprometida: `${t('trazabilidad.cadenaComprometidaDetalle')} ${t('trazabilidad.veredicto.comprometidaAccion')}`,
  }[estado]

  // «Última verificación por equipo»: la constancia más reciente de la lista.
  const ultimaPorEquipo = registros.find((r) => r.tipo_evento === 'VERIFICACION_INTEGRIDAD')
  // Cada dato: valor en `text-body` y, si hace falta, una segunda línea en
  // `text-meta` (antes la última columna iba entera en 12 px y las fechas
  // partían «7/11/2026, / 1:14:44 p. m.» donde caía el corte).
  const textoUltima = ultimaPorEquipo ? (
    <>
      <span className="codigo block">{ultimaPorEquipo.device_id ?? (ultimaPorEquipo.payload?.device_id as string | undefined) ?? '—'}</span>
      <span className="nums block text-meta text-muted">
        {`${fechaHora(ultimaPorEquipo.timestamp)} · ${t(ultimaPorEquipo.payload?.integra === false ? 'trazabilidad.segmento.resultadoRoto' : 'trazabilidad.segmento.resultadoIntegro')}`}
      </span>
    </>
  ) : (
    t('trazabilidad.datos.ninguna')
  )
  const ContenedorDatos = verificacion ? 'div' : 'details'
  const posteriores = verificacion?.registros_posteriores_afectados ?? 0
  const textoBoton = verificando
    ? t('trazabilidad.verificando')
    : verificacion
      ? t('trazabilidad.veredicto.revisarDeNuevo')
      : t('trazabilidad.verificar')

  return (
    <section
      aria-labelledby="veredicto-titulo"
      aria-busy={verificando || undefined}
      className={cn('min-w-0 border-l-[3px] p-4 xl:p-5', borde)}
    >
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
        <Icono key={`icono-${estado}`} aria-hidden className={cn('cambio-texto mt-0.5 size-6 shrink-0', estado === 'sin_verificar' ? 'text-subtle' : color)} />
        <div className="min-w-0 flex-1 basis-64" role={alerta ? 'alert' : 'status'}>
          <h2 id="veredicto-titulo" key={verificando ? 'verificando' : estado} className={cn('cambio-texto text-title', verificando ? 'text-foreground' : color)}>
            {titulo}
          </h2>
          <p className="mt-1 text-body text-muted text-pretty">{texto}</p>
        </div>
        <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto">
          {selectorCadena}
          {onAislar && (
            <Button variant="danger" size="sm" className="max-sm:w-full" onClick={onAislar}>
              {t('trazabilidad.aislar')}
            </Button>
          )}
          {estado === 'ruptura_detectada' && onVerEnTabla && (
            <Button variant="secondary" size="sm" className="max-sm:w-full" onClick={onVerEnTabla}>
              {t('trazabilidad.veredicto.verEnTabla')}
            </Button>
          )}
          <Button
            size="sm"
            variant={estado === 'ruptura_detectada' ? 'ghost' : verificacion ? 'secondary' : 'primary'}
            className="max-sm:w-full"
            aria-busy={verificando || undefined}
            disabled={verificando}
            onClick={onVerificar}
          >
            {verificando ? <Loader2 aria-hidden className="animate-spin" /> : <ShieldCheck aria-hidden />}
            <span key={textoBoton} className="cambio-texto">{textoBoton}</span>
          </Button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-(--radius-field) bg-critical-tint px-3 py-2 text-meta text-critical">{error}</p>
      )}

      {estado === 'ruptura_detectada' && detalle ? (
        <div data-testid="detalle-inconsistencia" className="mt-4 border-t border-border pt-3">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            <Dato etiqueta={t('trazabilidad.evento')}>{etiquetaEvento(detalle.tipo_evento, t)}</Dato>
            <Dato etiqueta={t('trazabilidad.fecha')} className="nums">{fechaHora(detalle.timestamp)}</Dato>
            {detalle.tipo_discrepancia && (
              <Dato etiqueta={t('trazabilidad.tipoDiscrepancia')}>{t(`trazabilidad.discrepancia_${detalle.tipo_discrepancia}`)}</Dato>
            )}
            {posteriores > 0 && (
              <Dato etiqueta={t('trazabilidad.posterioresAfectados')} className="nums text-critical">{posteriores}</Dato>
            )}
            {/* HU-26 escenario 2: una alteración puntual no invalida lo posterior. */}
            {posteriores > 0 && verificacion?.registros_posteriores_consistentes != null && (
              <Dato etiqueta={t('trazabilidad.posterioresConsistentes')} className="nums">
                {t('trazabilidad.posterioresConsistentesValor', { c: verificacion.registros_posteriores_consistentes, n: posteriores })}
              </Dato>
            )}
            {(verificacion?.total_rupturas ?? 0) > 1 && (
              <Dato etiqueta={t('trazabilidad.totalRupturas')} className="nums text-critical">{verificacion?.total_rupturas}</Dato>
            )}
            {datosCadena}
          </dl>
          <Detalles className="mt-2">
            <ComparacionSellos detalle={detalle} />
          </Detalles>
          <AlcanceVerificacion texto={verificacion?.alcance} className="mt-3" />
        </div>
      ) : (
        <>
          <ContenedorDatos>
            {!verificacion && <summary className="mt-2 w-fit cursor-pointer py-2 text-meta font-medium text-muted">{t('registros.datosCadena')}</summary>}
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-3 sm:grid-cols-4">
              {estado === 'ruptura_aislada' ? (
                <>
                  <Dato etiqueta={t('trazabilidad.totalRupturas')} className="nums">{verificacion?.total_rupturas ?? 1}</Dato>
                  <Dato etiqueta={t('trazabilidad.datos.integraDesde')} className="nums"><FechaEnDosLineas iso={verificacion?.integra_desde} /></Dato>
                  <Dato etiqueta={t('trazabilidad.datos.verificados')} className="nums">{verificacion?.total_registros ?? '—'}</Dato>
                </>
              ) : estado === 'integra' ? (
                <>
                  <Dato etiqueta={t('trazabilidad.datos.verificados')} className="nums">{verificacion?.total_registros ?? '—'}</Dato>
                  <Dato etiqueta={t('trazabilidad.datos.ultimo')} className="nums"><FechaEnDosLineas iso={registros[0]?.timestamp} /></Dato>
                </>
              ) : estado === 'no_concluida' ? (
                <>
                  <Dato etiqueta={t('trazabilidad.datos.verificados')} className="nums">{verificacion?.total_registros ?? '—'}</Dato>
                  <Dato etiqueta={t('trazabilidad.datos.noVerificables')} className="nums text-warning-700">{verificacion?.total_no_verificables ?? 0}</Dato>
                </>
              ) : (
                <>
                  <Dato etiqueta={t('trazabilidad.datos.registros')} className="nums">{registros.length >= 200 ? '200+' : registros.length}</Dato>
                  <Dato etiqueta={t('trazabilidad.datos.primero')} className="nums"><FechaEnDosLineas iso={registros.at(-1)?.timestamp} /></Dato>
                  <Dato etiqueta={t('trazabilidad.datos.ultimo')} className="nums"><FechaEnDosLineas iso={registros[0]?.timestamp} /></Dato>
                </>
              )}
              {datosCadena}
              <Dato etiqueta={t('trazabilidad.datos.ultimaVerificacionEquipo')}>{textoUltima}</Dato>
            </dl>
          </ContenedorDatos>
          {/* HU-26 esc. 4: el alcance se declara junto al resultado, a la vista. */}
          {verificacion && <AlcanceVerificacion texto={verificacion.alcance} className="mt-3" />}
        </>
      )}
    </section>
  )
}

/** Fecha en `text-body` y hora debajo en `text-meta`: el corte siempre cae en el mismo sitio. */
function FechaEnDosLineas({ iso }: { iso: string | null | undefined }) {
  if (!iso) return <>—</>
  return (
    <>
      <span className="block">{fechaCorta(iso)}</span>
      <span className="block text-meta text-muted">{hora(iso)}</span>
    </>
  )
}

/** Sello recalculado frente a almacenado, con el prefijo común atenuado. */
export function ComparacionSellos({ detalle }: { detalle: DetalleInconsistencia }) {
  const { t } = useTranslation()
  const desde = primerCaracterDistinto(detalle.hash_esperado, detalle.hash_almacenado)
  const sello = (valor: string, color: string) =>
    desde < 0 ? (
      <span className={color}>{valor}</span>
    ) : (
      <>
        <span className="text-faint">{valor.slice(0, desde)}</span>
        <span className={color}>{valor.slice(desde)}</span>
      </>
    )
  return (
    <dl className="grid gap-3">
      <Dato etiqueta={t('trazabilidad.registroAfectado')} className="flex min-w-0 items-center gap-1">
        <span className="codigo min-w-0 break-all">{detalle.id}</span>
        <BotonCopiar valor={detalle.id} campo={t('trazabilidad.registroAfectado')} />
      </Dato>
      <Dato etiqueta={t('trazabilidad.hashEsperado')} className="codigo break-all text-meta">{sello(detalle.hash_esperado, 'text-success-700')}</Dato>
      <Dato etiqueta={t('trazabilidad.hashAlmacenado')} className="codigo break-all text-meta">{sello(detalle.hash_almacenado, 'text-critical')}</Dato>
      {desde >= 0 && <p className="text-meta text-muted">{t('trazabilidad.diferencia', { n: desde + 1 })}</p>}
    </dl>
  )
}

/** HU-26 escenario 4: el resultado declara qué certifica y qué no. */
export function AlcanceVerificacion({ texto, className }: { texto?: string; className?: string }) {
  const { t } = useTranslation()
  return (
    <p data-testid="alcance-verificacion" className={cn('max-w-[72ch] text-meta text-muted', className)}>
      {texto ?? t('trazabilidad.alcanceVerificacion')}
    </p>
  )
}
