import { useMemo, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { CircleAlert, CircleCheck, Plus, RotateCw, X } from 'lucide-react'

import { useDispositivos } from '@/application/hooks/useDispositivos'
import { rangoPagina } from '@/lib/paginacion'
import { useResponsivePageSize } from '@/presentation/hooks/useResponsivePageSize'
import { EstadoError } from '../components/EstadoPagina'
import { PageHeader } from '../components/PageHeader'
import { Paginacion } from '../components/Paginacion'
import { Button } from '../components/ui/button'
import { BloqueVacio, CifraFrase, FrasePantalla } from './usuarios/piezas'
import { DialogosEquipo } from './equipos/DialogosEquipo'
import { tonoEquipo } from './equipos/estadoEquipo'
import { FichaEquipo } from './equipos/FichaEquipo'
import { EsqueletoEquipos, PiezaEquipo } from './equipos/PiezaEquipo'
import { useAccionesEquipo } from './equipos/useAccionesEquipo'

/** Las piezas se reparten el ancho: cada fila se llena, sin huecos al final. */
const REJILLA = 'flex flex-wrap gap-3 sm:gap-4'

export function DispositivosPage() {
  const { t } = useTranslation()
  const estado = useDispositivos()
  const { dispositivos, cargando } = estado
  // useDispositivos todavía no distingue un fallo de una lista vacía; la pantalla ya lo atiende.
  const errorCarga = 'errorCarga' in estado && estado.errorCarga === true
  const a = useAccionesEquipo(estado)
  const [pagina, setPagina] = useState(1)
  const tamanoPagina = useResponsivePageSize()
  // Solo se pinta la página visible: estas listas crecen sin techo.
  const visibles = useMemo(() => dispositivos.slice(...rangoPagina(pagina, tamanoPagina)), [dispositivos, pagina, tamanoPagina])
  // Una frase en lugar de cuatro cifras: cuántos equipos hay y si alguno necesita que lo miren.
  const resumen = useMemo(() => {
    const enServicio = dispositivos.filter((d) => d.activo)
    return {
      enServicio: enServicio.length,
      revisar: enServicio.filter((d) => tonoEquipo(d) !== 'enLinea').length,
      deBaja: dispositivos.length - enServicio.length,
    }
  }, [dispositivos])

  const flota = a.mensajeFlota
  const sinEquipos = !cargando && !errorCarga && dispositivos.length === 0

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        eyebrow={t('nav.dispositivos')}
        titulo={t('dispositivos.titulo')}
        descripcion={t('dispositivos.descripcion')}
      >
        {/* Sin equipos, el gesto es el bloque grande de abajo: no hacen falta dos. */}
        {!sinEquipos && (
          <Button onClick={a.abrirRegistro}>
            <Plus aria-hidden />
            {t('dispositivos.nuevoEquipo')}
          </Button>
        )}
      </PageHeader>

      <section aria-label={t('dispositivos.resumenIoT')} className="-mt-2 mb-6 sm:-mt-4 sm:mb-8">
        <FrasePantalla className="min-h-7">
          {!cargando && !errorCarga && dispositivos.length > 0 && (
            <>
              <Trans t={t} i18nKey="dispositivos.resumenEquipos" count={resumen.enServicio} components={{ n: <CifraFrase valor={resumen.enServicio} /> }} />
              {resumen.enServicio > 0 && (
                <>
                  {': '}
                  {resumen.revisar > 0 ? (
                    <strong className="font-semibold text-foreground">{t('dispositivos.resumenRevisar', { count: resumen.revisar })}</strong>
                  ) : (
                    t('dispositivos.resumenBien', { count: resumen.enServicio })
                  )}
                </>
              )}
              .{resumen.deBaja > 0 && <> {t('dispositivos.resumenBaja', { count: resumen.deBaja })}.</>}
            </>
          )}
        </FrasePantalla>
      </section>

      {flota && (
        <div className="animate-fade mb-5 flex items-start gap-2.5 rounded-[18px] bg-capsula py-2.5 pl-4 pr-1.5 text-white shadow-(--shadow-capsula)">
          {flota.tipo === 'ok' ? (
            <CircleCheck aria-hidden className="mt-1 size-4 shrink-0 text-[#00d1ff]" />
          ) : (
            <CircleAlert aria-hidden className="mt-1 size-4 shrink-0 text-[#ff8a80]" />
          )}
          <p role={flota.tipo === 'error' ? 'alert' : 'status'} className="min-w-0 flex-1 py-0.5 text-[14px] leading-5">
            {flota.texto}
          </p>
          <button
            type="button"
            aria-label={t('comunes.cerrar')}
            onClick={() => a.setMensajeFlota(null)}
            className="realce grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-white/80 pointer-coarse:size-11"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>
      )}

      {cargando ? (
        <EsqueletoEquipos />
      ) : errorCarga ? (
        <EstadoError mensaje={t('dispositivos.errorCargar')}>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => window.location.reload()}>
            <RotateCw aria-hidden />
            {t('comunes.recargarPagina')}
          </Button>
        </EstadoError>
      ) : sinEquipos ? (
        <BloqueVacio
          titulo={t('dispositivos.sinDispositivos')}
          detalle={t('dispositivos.sinDispositivosAyuda')}
          accion={t('dispositivos.nuevoEquipo')}
          onAccion={a.abrirRegistro}
        />
      ) : (
        <div className="animate-fade min-w-0">
          <div role="table" aria-label={t('dispositivos.titulo')} className={REJILLA}>
            <div role="row" className="sr-only">
              <div role="columnheader">{t('dispositivos.estado')}</div>
              <div role="columnheader">{t('dispositivos.nombreEquipo')}</div>
              <div role="columnheader">{t('dispositivos.calibracion')}</div>
              <div role="columnheader">{t('comunes.acciones')}</div>
            </div>
            {visibles.map((dispositivo) => (
              <PiezaEquipo key={dispositivo.id} d={dispositivo} a={a} />
            ))}
          </div>
          <Paginacion total={dispositivos.length} pagina={pagina} onCambiar={setPagina} tamano={tamanoPagina} />
        </div>
      )}

      <FichaEquipo a={a} />
      <DialogosEquipo a={a} />
    </div>
  )
}
