import { useId, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, TriangleAlert } from 'lucide-react'

import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { rangoPagina } from '@/lib/paginacion'
import { cn } from '@/lib/utils'
import { Paginacion } from '../../components/Paginacion'
import {
  cintaDelDia,
  duracionTexto,
  hora24,
  resumir,
  salidasDeRango,
  tituloDeDia,
  type DiaDeLecturas,
  type SalidaDeRango,
} from './agrupar'
import { transicionPieza } from './movimiento'
import { TablaLecturas } from './TablaLecturas'

/** Más salidas que esto en un día se cuentan, pero no se listan: la lista completa sigue plegada abajo. */
const SALIDAS_VISIBLES = 5
const LECTURAS_POR_PAGINA = 10
const MARCAS_EJE = ['00', '06', '12', '18', '24']

/** La franja de riesgo de 00:00 a 24:00. Decorativa para el lector: las cifras están en las tablas. */
function CintaDia({ lecturas }: { lecturas: LecturaTermica[] }) {
  const cinta = useMemo(() => cintaDelDia(lecturas), [lecturas])
  return (
    <div aria-hidden>
      <div className="cinta-dia">
        {cinta.map((riesgo, indice) => (
          <span key={indice} data-riesgo={riesgo ?? undefined} />
        ))}
      </div>
      <div className="cinta-dia__eje nums">
        {MARCAS_EJE.map((marca) => (
          <span key={marca}>{marca}</span>
        ))}
      </div>
    </div>
  )
}

function horasDe(salida: SalidaDeRango) {
  const inicio = hora24(salida.inicio)
  const fin = hora24(salida.fin)
  return inicio === fin ? inicio : `${inicio} – ${fin}`
}

/** Una salida del rango: la fila crece hasta ser su detalle, con las lecturas que la forman. */
function FilaSalida({
  salida,
  abierta,
  onAlternar,
  onVerEvidencia,
}: {
  salida: SalidaDeRango
  abierta: boolean
  onAlternar: () => void
  onVerEvidencia: (lectura: LecturaTermica) => void
}) {
  const { t } = useTranslation()
  const reducir = useReducedMotion()
  const transicion = transicionPieza(reducir)
  const idDetalle = useId()
  const [pagina, setPagina] = useState(1)
  // La tabla lee de la más reciente a la más antigua, como el resto del historial.
  const lecturas = useMemo(() => [...salida.lecturas].reverse(), [salida.lecturas])
  const visibles = lecturas.slice(...rangoPagina(pagina, LECTURAS_POR_PAGINA))
  const fria = salida.extremo !== null && salida.extremo < 2
  const datos = [
    salida.lecturas.length > 1
      ? duracionTexto(Date.parse(salida.fin) - Date.parse(salida.inicio))
      : t('historial.lecturasDia', { count: 1 }),
    salida.device_id,
    salida.puertaAbierta ? t('historial.salidaPuerta') : null,
  ].filter(Boolean)
  const cifra = salida.extremo !== null ? `${salida.extremo.toFixed(1)} °C` : null
  // El nombre se dice de corrido, con sus pausas; lo visible va en piezas sin separadores.
  const nombre = [`${t('historial.salidaNombre')}:`, cifra, horasDe(salida), datos.join(', ')].filter(Boolean).join(' · ')

  return (
    <motion.li layout="position" transition={transicion}>
      <motion.div
        layoutId={`salida-${salida.id}`}
        transition={transicion}
        data-abierta={abierta}
        className="salida rounded-[14px]"
      >
        <motion.button
          layout="position"
          transition={transicion}
          type="button"
          aria-expanded={abierta}
          aria-controls={abierta ? idDetalle : undefined}
          aria-label={nombre}
          onClick={onAlternar}
          className="salida__fila realce focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span
            className={cn(
              'salida__cifra nums',
              fria ? 'bg-campo-frio text-campo-frio-tinta' : 'bg-campo-critico text-campo-critico-tinta',
            )}
          >
            {salida.extremo !== null ? (
              <>
                {salida.extremo.toFixed(1)}
                <span className="salida__unidad">°C</span>
              </>
            ) : (
              <TriangleAlert aria-hidden className="size-5" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="salida__horas nums">{horasDe(salida)}</span>
            <span className="salida__datos">{datos.join(' · ')}</span>
          </span>
          <ChevronDown aria-hidden className={cn('salida__flecha', abierta && 'rotate-180')} />
        </motion.button>

        {abierta && (
          <motion.div
            layout="position"
            id={idDetalle}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={reducir ? { duration: 0 } : { duration: 0.18, delay: 0.08 }}
            className="salida__detalle"
          >
            <TablaLecturas
              titulo={t('historial.salidaTabla', { hora: hora24(salida.inicio) })}
              lecturas={visibles}
              onVerEvidencia={onVerEvidencia}
            />
            {lecturas.length > LECTURAS_POR_PAGINA && (
              <Paginacion total={lecturas.length} pagina={pagina} onCambiar={setPagina} tamano={LECTURAS_POR_PAGINA} />
            )}
          </motion.div>
        )}
      </motion.div>
    </motion.li>
  )
}

function ResumenDia({
  dia,
  abierta,
  onAlternar,
  onVerEvidencia,
}: {
  dia: DiaDeLecturas
  abierta: string | null
  onAlternar: (id: string) => void
  onVerEvidencia: (lectura: LecturaTermica) => void
}) {
  const { t } = useTranslation()
  const reducir = useReducedMotion()
  const idTitulo = useId()
  const resumen = resumir(dia.lecturas)
  const salidas = useMemo(() => salidasDeRango(dia.lecturas), [dia.lecturas])
  const titulo = tituloDeDia(dia.clave, t)
  const extremos =
    resumen.minima !== null && resumen.maxima !== null
      ? t('historial.diaEntre', { minima: resumen.minima.toFixed(1), maxima: resumen.maxima.toFixed(1) })
      : null

  return (
    <motion.section layout="position" transition={transicionPieza(reducir)} aria-labelledby={idTitulo} className="dia-resumen">
      <header className="dia-resumen__cabeza">
        <h3 id={idTitulo} className="dia-resumen__titulo first-letter:uppercase">{titulo}</h3>
        <p className="dia-resumen__frase">
          {resumen.minima === null ? (
            t('historial.diaSinTemperatura')
          ) : salidas.length > 0 ? (
            <span className="font-semibold text-critical">{t('historial.diaFuera', { count: salidas.length })}</span>
          ) : (
            <span className="font-semibold text-foreground">{t('historial.diaDentro')}</span>
          )}
          {extremos && (
            <>
              {' · '}
              <span className="nums whitespace-nowrap text-muted">{extremos}</span>
            </>
          )}
        </p>
      </header>

      <CintaDia lecturas={dia.lecturas} />

      {salidas.length > 0 && (
        <ol className="salidas" aria-label={t('historial.salidasDelDia', { dia: titulo })}>
          {salidas.slice(0, SALIDAS_VISIBLES).map((salida) => (
            <FilaSalida
              key={salida.id}
              salida={salida}
              abierta={abierta === salida.id}
              onAlternar={() => onAlternar(salida.id)}
              onVerEvidencia={onVerEvidencia}
            />
          ))}
        </ol>
      )}
      {salidas.length > SALIDAS_VISIBLES && (
        <p className="mt-2 text-[13.5px] leading-5 text-muted">
          {t('historial.salidasMas', { count: salidas.length - SALIDAS_VISIBLES })}
        </p>
      )}
    </motion.section>
  )
}

/**
 * Día por día, solo lo que importa: si estuvo siempre dentro del rango y, si salió, cada salida en una
 * fila que se abre. Las lecturas completas siguen plegadas abajo.
 */
export function ResumenDias({ dias, onVerEvidencia }: { dias: DiaDeLecturas[]; onVerEvidencia: (lectura: LecturaTermica) => void }) {
  const { t } = useTranslation()
  const [abierta, setAbierta] = useState<string | null>(null)
  return (
    <section aria-labelledby="historial-por-dia" className="mt-[clamp(28px,4vw,44px)]">
      <h2 id="historial-por-dia" className="sr-only">{t('historial.porDia')}</h2>
      <div className="dias-resumen">
        {dias.map((dia) => (
          <ResumenDia
            key={dia.clave}
            dia={dia}
            abierta={abierta}
            onAlternar={(id) => setAbierta((actual) => (actual === id ? null : id))}
            onVerEvidencia={onVerEvidencia}
          />
        ))}
      </div>
    </section>
  )
}
