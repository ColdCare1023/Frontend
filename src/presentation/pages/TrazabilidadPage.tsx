import { useEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { Trans, useTranslation } from 'react-i18next'
import { Fingerprint, FlaskConical, Link2, TriangleAlert } from 'lucide-react'

import { useTrazabilidad } from '@/application/hooks/useTrazabilidad'
import { useAuthStore } from '@/application/stores/authStore'
import { apiClient } from '@/infrastructure/api/apiClient'
import { fechaHora, localeActual } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { rangoPagina } from '@/lib/paginacion'
import { useResponsivePageSize } from '@/presentation/hooks/useResponsivePageSize'
import { EstadoCarga, EstadoError, EstadoVacio } from '../components/EstadoPagina'
import { Paginacion } from '../components/Paginacion'
import { BarraFiltros, type FiltroActivo } from '../components/ui/barra-filtros'
import { Button } from '../components/ui/button'
import { Detalles } from '../components/ui/detalles'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../components/ui/dialog'
import { Campo, Input, NativeSelect } from '../components/ui/input'
import { NumeroAnimado } from '../components/ui/numero-animado'
import { SelectorFecha } from '../components/ui/selector-fecha'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { useCoincideMedia } from '../components/ui/useCoincideMedia'
import { AccionComprobar } from './integridad/AccionComprobar'
import { TAMANO_CADENA, armarCadena, etiquetaEvento, veredictoDe, type Veredicto } from './integridad/cadena'
import { CadenaSellos } from './integridad/CadenaSellos'
import { AlcanceVerificacion, DetalleRuptura, ResultadoSegmento, SelloTecnico } from './integridad/Resultados'
import './integridad/integridad.css'

const TIPOS_EVENTO = [
  'LECTURA_TERMICA',
  'ALERTA_TERMICA',
  'ACCION_CORRECTIVA',
  'REPORTE_BPA',
  'AUDITORIA',
  'CONECTIVIDAD',
]

/* Sobre el color: blanco, como los botones de la sección de la landing. */
const BOTON_BLANCO = 'border-0 bg-white text-[#0f172a]'

const CAPAS: Veredicto[] = ['sin_revisar', 'integra', 'rota', 'aislada']

/** La cifra aparece rodando desde cero la primera vez y rueda de nuevo si cambia. */
function CifraQueRueda({ valor }: { valor: number }) {
  const texto = String(valor)
  const [visible, setVisible] = useState(() => '0'.repeat(texto.length))
  useEffect(() => setVisible(texto), [texto])
  return <NumeroAnimado valor={visible} />
}

function horaCorta(ms: number) {
  return new Date(ms).toLocaleTimeString(localeActual(), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
}

/** Mientras llegan los registros, el sitio del dibujo ya está reservado: no hay salto al cargar. */
function CadenaEnBlanco() {
  return (
    <ol aria-hidden className="cadena cadena--blanco">
      {Array.from({ length: TAMANO_CADENA }, (_, i) => (
        <li key={i} className="cadena__item">
          <div className="sello" />
        </li>
      ))}
    </ol>
  )
}

export function TrazabilidadPage() {
  const { t } = useTranslation()
  const reducir = useReducedMotion()
  const {
    registros,
    cargando,
    errorCarga,
    consultar,
    verificacion,
    verificando,
    verificarIntegridad,
    estadoCadena,
    aislarCorrupcion,
    verificacionSegmento,
    verificandoSegmento,
    errorSegmento,
    verificarPorDispositivo,
  } = useTrazabilidad()
  const [pagina, setPagina] = useState(1)
  const tamanoPagina = useResponsivePageSize()
  // HU-37: verificación acotada a un dispositivo y periodo.
  const [segmentoDeviceId, setSegmentoDeviceId] = useState('')
  const [segmentoDesde, setSegmentoDesde] = useState('')
  const [segmentoHasta, setSegmentoHasta] = useState('')
  const [faltaDesde, setFaltaDesde] = useState(false)
  // La lista completa puede tener miles de filas; solo se pinta la página
  // visible. Al cambiar la lista (filtro nuevo) se vuelve a la primera.
  const visibles = useMemo(() => registros.slice(...rangoPagina(pagina, tamanoPagina)), [registros, pagina, tamanoPagina])
  const [tipoEvento, setTipoEvento] = useState('')
  const [mostrarSellos, setMostrarSellos] = useState(false)
  const [aislando, setAislando] = useState(false)
  const [confirmarAislar, setConfirmarAislar] = useState(false)
  const [errorAislar, setErrorAislar] = useState(false)
  const [errorVerificar, setErrorVerificar] = useState(false)
  const [comprobadoEn, setComprobadoEn] = useState<number | null>(null)
  const usuario = useAuthStore((s) => s.usuario)
  const campoRef = useRef<HTMLElement>(null)
  // En el teléfono el dibujo es más corto: tres registros bastan para ver cómo se unen.
  const enTelefono = useCoincideMedia('(max-width: 639px)')

  // Cada resultado nuevo vuelve a timbrar la cadena desde el primer sello.
  const [ronda, setRonda] = useState(0)
  const [verificacionVista, setVerificacionVista] = useState(verificacion)
  if (verificacion !== verificacionVista) {
    setVerificacionVista(verificacion)
    setRonda((actual) => actual + 1)
  }

  const veredicto = veredictoDe(verificacion)
  const detalle = verificacion?.detalle_inconsistencia ?? null
  const comprometida = estadoCadena?.cadena_comprometida === true
  const cadena = useMemo(
    () => armarCadena(registros, verificacion, enTelefono ? 3 : TAMANO_CADENA),
    [registros, verificacion, enTelefono],
  )
  // Sin revisar pero ya señalada como comprometida (HU-47), el campo también va en rojo.
  const campo: Veredicto = veredicto === 'sin_revisar' && comprometida ? 'rota' : veredicto

  // El selector de fecha no impone `min`/`max` como el campo nativo: el rango
  // invertido se marca en los dos campos y se explica antes de enviar.
  const segmentoInvertido = Boolean(segmentoDesde && segmentoHasta && segmentoDesde > segmentoHasta)
  const mensajeSegmento =
    segmentoInvertido || errorSegmento === 'rango_invalido'
      ? t('trazabilidad.rangoInvalido')
      : errorSegmento
        ? t('comunes.error')
        : null

  const revisar = async () => {
    setErrorVerificar(false)
    try {
      await verificarIntegridad()
      setComprobadoEn(Date.now())
    } catch {
      setErrorVerificar(true)
    }
  }

  const simular = async () => {
    setErrorVerificar(false)
    try {
      await apiClient.post('/api/demo/trazabilidad/simular-inconsistencia')
    } catch {
      setErrorVerificar(true)
      return
    }
    await revisar()
    // El veredicto está arriba: quien simuló desde los detalles lo ve cambiar.
    campoRef.current?.scrollIntoView?.({ block: 'start', behavior: reducir ? 'auto' : 'smooth' })
  }

  const aislar = async () => {
    if (!detalle) return
    setAislando(true)
    setErrorAislar(false)
    const resultado = await aislarCorrupcion(detalle.id)
    setAislando(false)
    if (resultado === 'ok') {
      setConfirmarAislar(false)
      // El veredicto en pantalla era el de antes de aislar: se vuelve a revisar.
      void revisar()
    } else setErrorAislar(true)
  }

  const verificarSegmento = () => {
    // «Desde» es obligatorio: sin el aviso nativo del campo `date`, el campo
    // se marca y recibe el foco para que el envío no falle en silencio.
    if (!segmentoDesde) {
      setFaltaDesde(true)
      document.getElementById('seg-desde')?.focus()
      return
    }
    if (!segmentoDeviceId || segmentoInvertido) return
    const desdeISO = new Date(`${segmentoDesde}T00:00:00`).toISOString()
    const hastaISO = segmentoHasta
      ? new Date(`${segmentoHasta}T23:59:59.999`).toISOString()
      : new Date().toISOString()
    void verificarPorDispositivo(segmentoDeviceId, desdeISO, hastaISO)
  }

  const elegirTipo = (valor: string) => {
    setTipoEvento(valor)
    setPagina(1)
    void consultar(valor || undefined)
  }

  const activos: FiltroActivo[] = tipoEvento
    ? [{ id: 'tipo', etiqueta: etiquetaEvento(tipoEvento, t), onQuitar: () => elegirTipo('') }]
    : []

  // La pregunta mientras no hay respuesta; la respuesta, en palabras, cuando la hay.
  const titulo =
    campo === 'integra'
      ? t('trazabilidad.cadenaIntegra')
      : campo === 'aislada'
        ? t('trazabilidad.rupturaAislada')
        : veredicto === 'rota'
          ? t('trazabilidad.cadenaRota', { count: verificacion?.total_rupturas ?? 1 })
          : t('trazabilidad.sinRevisar')
  const explicacion =
    veredicto === 'integra' && verificacion ? (
      <Trans
        i18nKey="trazabilidad.cadenaIntegraDetalle"
        count={verificacion.total_registros}
        components={{ n: <CifraQueRueda valor={verificacion.total_registros} /> }}
      />
    ) : veredicto === 'aislada' && verificacion ? (
      t('trazabilidad.rupturaAisladaDetalle', { count: verificacion.total_rupturas ?? 1, fecha: fechaHora(verificacion.integra_desde) })
    ) : veredicto === 'rota' && detalle ? (
      // En palabras: qué registro es y de cuándo. Su posición en la cadena queda en los detalles técnicos.
      t('trazabilidad.cadenaRotaRegistro', {
        evento: etiquetaEvento(detalle.tipo_evento, t),
        fecha: new Date(detalle.timestamp).toLocaleDateString(localeActual(), { day: 'numeric', month: 'long', year: 'numeric' }),
        hora: horaCorta(Date.parse(detalle.timestamp)),
      })
    ) : veredicto === 'rota' && verificacion ? (
      t('trazabilidad.cadenaRotaDetalle', { n: verificacion.primer_registro_inconsistente })
    ) : (
      t('trazabilidad.cadenaExplicacion')
    )

  return (
    <div className="flex flex-1 flex-col">
      {/* ── La pregunta, un botón y la respuesta, en un campo de color ───────── */}
      <section
        ref={campoRef}
        aria-labelledby="comprobar-titulo"
        data-veredicto={campo}
        data-solo-veredicto={cadena.length === 0 && !cargando}
        className="campo-integridad"
      >
        {CAPAS.map((capa) => (
          <span key={capa} aria-hidden data-capa={capa} data-activa={capa === campo} className="campo-integridad__capa" />
        ))}

        <div className="min-w-0">
          <h1 id="comprobar-titulo" className="campo-integridad__nombre">{t('trazabilidad.titulo')}</h1>
          <div role="status">
            <h2 key={`${campo}-${veredicto}`} className="campo-integridad__titulo animate-fade">{titulo}</h2>
            <p className="campo-integridad__explicacion nums">{explicacion}</p>
          </div>

          {/* HU-47: una cadena de custodia comprometida es el equivalente
              documental de una excursión térmica; se anuncia (`role="alert"`),
              no solo se pinta en rojo (WCAG 4.1.3). */}
          {comprometida && (
            <div role="alert" className="mt-4 max-w-[46ch] text-[14px] leading-5">
              <p className="font-semibold">{t('trazabilidad.cadenaComprometida')}</p>
              <p className="mt-0.5">{t('trazabilidad.cadenaComprometidaDetalle')}</p>
            </div>
          )}
          {errorVerificar && (
            <p role="alert" className="mt-4 max-w-[46ch] text-[14px] leading-5 font-semibold">{t('comunes.error')}</p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <AccionComprobar
              comprobando={verificando}
              comprobado={verificacion !== null}
              hora={comprobadoEn === null ? null : horaCorta(comprobadoEn)}
              onComprobar={() => void revisar()}
            />
            {comprometida && usuario?.rol === 'administrador' && detalle && (
              <Button variant="secondary" size="lg" className={cn(BOTON_BLANCO, 'text-critical-solid')} onClick={() => setConfirmarAislar(true)}>
                {t('trazabilidad.aislar')}
              </Button>
            )}
          </div>

          {/* El límite de lo que prueba la comprobación: siempre a la vista, con o sin revisión. */}
          <p className="campo-integridad__limite">{t('trazabilidad.advertenciaSimple')}</p>
        </div>

        {cadena.length > 0 ? (
          <CadenaSellos key={ronda} eslabones={cadena} tecnico={mostrarSellos} />
        ) : (
          cargando && <CadenaEnBlanco />
        )}
      </section>

      {verificacion && veredicto === 'rota' && detalle && <DetalleRuptura verificacion={verificacion} detalle={detalle} />}

      {errorCarga && !cargando && registros.length === 0 && (
        <div className="mt-4">
          <EstadoError mensaje={t('trazabilidad.errorCargar')} onReintentar={() => void consultar(tipoEvento || undefined)} />
        </div>
      )}

      {/* ── Lo técnico, la demo, los filtros y la lista: plegados ─────────────── */}
      <Detalles
        className="detalles-tecnicos"
        titulo={<span className="text-[15px] font-semibold text-foreground">{t('trazabilidad.verDetallesTecnicos')}</span>}
      >
        <div className="space-y-4 pb-5">
          <div className="max-w-[78ch] space-y-2 text-[13.5px] leading-5 text-muted">
            {veredicto === 'rota' && verificacion && detalle && (
              <p className="nums font-medium text-foreground">
                {t('trazabilidad.cadenaRotaDetalle', { n: verificacion.primer_registro_inconsistente })}
              </p>
            )}
            <p>{t('trazabilidad.advertenciaSello')}</p>
            {verificacion && !(veredicto === 'rota' && detalle) && <AlcanceVerificacion texto={verificacion.alcance} />}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <BarraFiltros titulo={t('trazabilidad.tipoEvento')} activos={activos} onLimpiar={() => elegirTipo('')}>
              <Campo etiqueta={t('trazabilidad.tipoEvento')} htmlFor="f-evento" className="sm:col-span-2">
                <NativeSelect id="f-evento" value={tipoEvento} onChange={(e) => elegirTipo(e.target.value)}>
                  <option value="">{t('trazabilidad.todosEventos')}</option>
                  {TIPOS_EVENTO.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {etiquetaEvento(tipo, t)}
                    </option>
                  ))}
                </NativeSelect>
              </Campo>
            </BarraFiltros>

            {/* HU-37: verificación acotada a un dispositivo y periodo. */}
            <BarraFiltros titulo={t('trazabilidad.verificarSegmento')}>
              <form
                aria-label={t('trazabilidad.verificarSegmento')}
                className="contents"
                onSubmit={(e) => {
                  e.preventDefault()
                  verificarSegmento()
                }}
              >
                <Campo etiqueta={t('historial.dispositivo')} htmlFor="seg-device" className="sm:col-span-2">
                  <Input
                    id="seg-device"
                    value={segmentoDeviceId}
                    onChange={(e) => setSegmentoDeviceId(e.target.value)}
                    placeholder="FARM-01-CDL"
                    required
                  />
                </Campo>
                <Campo etiqueta={t('historial.desde')} htmlFor="seg-desde" ayuda={t('trazabilidad.desdeAyuda')}>
                  <SelectorFecha
                    id="seg-desde"
                    valor={segmentoDesde}
                    onCambiar={setSegmentoDesde}
                    invalido={(faltaDesde && !segmentoDesde) || segmentoInvertido}
                    aria-describedby="seg-desde-ayuda"
                  />
                </Campo>
                <Campo etiqueta={t('historial.hasta')} htmlFor="seg-hasta" ayuda={t('trazabilidad.hastaOpcional')}>
                  <SelectorFecha
                    id="seg-hasta"
                    valor={segmentoHasta}
                    onCambiar={setSegmentoHasta}
                    invalido={segmentoInvertido}
                    aria-describedby="seg-hasta-ayuda"
                  />
                </Campo>
                {mensajeSegmento && (
                  <p role="alert" className="rounded-(--radius-field) bg-critical-tint px-3 py-2 text-[13px] leading-5 text-critical sm:col-span-2">
                    {mensajeSegmento}
                  </p>
                )}
                <Button type="submit" variant="secondary" disabled={verificandoSegmento || segmentoInvertido} className="sm:col-span-2">
                  {verificandoSegmento ? t('trazabilidad.verificando') : t('trazabilidad.verificarSegmentoBoton')}
                </Button>
              </form>
            </BarraFiltros>

            {/* Los sellos, en la tabla y en el dibujo, tras un control. */}
            <Button variant="ghost" size="sm" aria-expanded={mostrarSellos} onClick={() => setMostrarSellos((actual) => !actual)}>
              <Fingerprint />
              {mostrarSellos ? t('trazabilidad.ocultarSellos') : t('trazabilidad.mostrarSellos')}
            </Button>

            {import.meta.env.MODE === 'demo' && (
              <Button variant="secondary" size="sm" className="sm:ml-auto" onClick={() => void simular()} disabled={verificando}>
                <FlaskConical />
                {t('trazabilidad.simular')}
              </Button>
            )}
          </div>

          {verificacionSegmento && <ResultadoSegmento resultado={verificacionSegmento} />}

          {/* ── Todos los registros ─────────────────────────────────────── */}
          <div className="flex min-w-0 flex-col">
            {errorCarga && !cargando && registros.length === 0 ? null : cargando && registros.length === 0 ? (
              <EstadoCarga variant="tabla" />
            ) : registros.length === 0 ? (
              <EstadoVacio icono={Link2} titulo={t('trazabilidad.sinRegistros')} />
            ) : (
              <>
                <Table
                  mobileLayout="stack"
                  className={cn('registros-tabla table-fixed min-w-0 transition-opacity', cargando && 'opacity-60')}
                  titulo={t('trazabilidad.listaRegistros')}
                  cargando={cargando}
                >
                  <TableHeader>
                    <TableRow>
                      <TableHead className={mostrarSellos ? 'w-[24%]' : 'w-[32%]'}>{t('trazabilidad.fecha')}</TableHead>
                      <TableHead className={mostrarSellos ? 'w-[24%]' : 'w-[40%]'}>{t('trazabilidad.evento')}</TableHead>
                      <TableHead className={mostrarSellos ? 'w-[16%]' : 'w-[28%]'}>{t('historial.dispositivo')}</TableHead>
                      {mostrarSellos && <TableHead className="w-[36%]">{t('trazabilidad.sellos')}</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibles.map((registro) => {
                      // El registro señalado por la verificación se marca en la
                      // propia tabla: quien llega a la fila desplazándose tiene que
                      // reconocerla.
                      const corrupto = detalle?.id === registro.id
                      return (
                        <TableRow
                          key={registro.id}
                          data-testid={corrupto ? 'fila-corrupta' : undefined}
                          className={cn(corrupto && 'bg-critical-tint hover:bg-critical-tint')}
                        >
                          <TableCell className="nums whitespace-nowrap text-[13.5px] text-muted max-sm:order-1">
                            {corrupto && (
                              <span className="mr-1.5 inline-flex align-[-2px] text-critical">
                                <TriangleAlert className="size-3.5" aria-hidden />
                                <span className="sr-only">{t('trazabilidad.registroAfectado')}: </span>
                              </span>
                            )}
                            {fechaHora(registro.timestamp)}
                          </TableCell>
                          <TableCell className="mobile-full text-sm font-medium max-sm:order-first">
                            {etiquetaEvento(registro.tipo_evento, t)}
                            {corrupto && <span className="timbre-fila ml-2">{t('trazabilidad.timbre.no_coincide')}</span>}
                          </TableCell>
                          <TableCell className="text-[13.5px] text-muted max-sm:order-2 max-sm:text-right">
                            {registro.device_id ?? '—'}
                          </TableCell>
                          {mostrarSellos && (
                            <TableCell data-label={t('trazabilidad.sellos')} className="mobile-full min-w-0 px-2 py-1.5 max-sm:order-3 max-sm:mt-2">
                              <div className="grid min-w-0 grid-cols-2 gap-1">
                                <SelloTecnico etiqueta={t('trazabilidad.hashAnterior')} hash={registro.previous_hash} />
                                <SelloTecnico etiqueta={t('trazabilidad.hash')} hash={registro.hash_actual} />
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
                <Paginacion total={registros.length} pagina={pagina} onCambiar={setPagina} tamano={tamanoPagina} />
              </>
            )}
          </div>
        </div>
      </Detalles>

      {/* Aislar un registro inconsistente es irreversible y afecta los datos
          que quedan disponibles para revisión: siempre con confirmación. */}
      <Dialog
        open={confirmarAislar}
        onOpenChange={(abierto) => {
          setConfirmarAislar(abierto)
          if (!abierto) setErrorAislar(false)
        }}
      >
        <DialogContent destructivo>
          <DialogTitle>{t('trazabilidad.aislar')}</DialogTitle>
          <DialogDescription>{t('trazabilidad.confirmarAislar')}</DialogDescription>
          {detalle && (
            <p className="nums mt-3 break-all rounded-(--radius-field) bg-surface-sunken px-3 py-2 text-[13px]">
              {detalle.id}
            </p>
          )}
          {errorAislar && (
            <p role="alert" className="mt-3 rounded-(--radius-field) bg-critical-tint px-3 py-2 text-[13px] text-critical">
              {t('comunes.error')}
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmarAislar(false)} disabled={aislando}>
              {t('comunes.cancelar')}
            </Button>
            <Button variant="danger" onClick={() => void aislar()} disabled={aislando}>
              {aislando ? t('trazabilidad.aislando') : t('trazabilidad.aislar')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
