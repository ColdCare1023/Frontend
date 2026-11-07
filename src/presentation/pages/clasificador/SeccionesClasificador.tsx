import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { CircleCheck, ShieldAlert, TriangleAlert } from 'lucide-react'

import { NumeroAnimado } from '@/presentation/components/ui/numero-animado'
import { matrizOrdenada } from './matrizOrdenada'
import './clasificador.css'

const VARIABLES_DESTACADAS = 3

/** Título de sección con filete y, si la evaluación no es verificable, su timbre: una captura suelta tampoco engaña. */
function TituloSeccion({ id, verificada, children }: { id: string; verificada: boolean; children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="seccion-clasificador__titulo">
      <h3 id={id}>{children}</h3>
      {!verificada && <span className="seccion-clasificador__sello">{t('metricasIA.selloMuestra')}</span>}
    </div>
  )
}

/** Cumple o no el criterio del prototipo. Sin origen verificable no se compara. */
export function Veredicto({ verificada, cumple, contextoUmbral }: { verificada: boolean; cumple: boolean; contextoUmbral: string }) {
  const { t } = useTranslation()
  return (
    <div role="status" data-testid="veredicto-umbral" className="flex items-start gap-2 text-sm leading-5">
      {/* WCAG 1.4.1: cumplir e incumplir usan iconos distintos. */}
      {cumple ? <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" /> : <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0" />}
      <span>
        <span className="font-semibold">
          {!verificada
            ? t('metricasIA.estadoNoVerificado')
            : cumple
              ? t('metricasIA.criterioSuperado')
              : t('metricasIA.criterioNoAlcanzado')}
        </span>{' '}
        {!verificada ? t('metricasIA.contextoNoVerificado') : contextoUmbral}
      </span>
    </div>
  )
}

/**
 * Lo primero que se ve: qué es el modelo, en una frase, y cuántas veces acertó, con su advertencia
 * al lado y del mismo peso. Sin origen verificable el campo lleva la trama de muestra y su timbre.
 */
export function CampoCifra({
  aciertos,
  mirados,
  verificada,
  cumple,
  contextoUmbral,
}: {
  aciertos: number
  /** Las variables que más pesan, ya en palabras. */
  mirados: string[]
  verificada: boolean
  cumple: boolean
  contextoUmbral: string
}) {
  const { t } = useTranslation()
  const estado = !verificada ? 'muestra' : cumple ? 'alcanza' : 'no-alcanza'
  return (
    <section id="resumen-evaluacion" aria-labelledby="resumen-evaluacion-titulo" className="campo-cifra" data-estado={estado}>
      <h2 id="resumen-evaluacion-titulo" className="sr-only">{t('metricasIA.resumenTitulo')}</h2>
      <div className="campo-cifra__rejilla">
        <p className="campo-cifra__frase">{t(verificada ? 'metricasIA.fraseSinAceptar' : 'metricasIA.fraseSinValidar')}</p>

        <div className="campo-cifra__acierto">
          <p>
            <span className="sr-only">
              {t(verificada ? 'metricasIA.aciertoFraseEvaluacion' : 'metricasIA.aciertoFrase', { n: aciertos })}
            </span>
            <span aria-hidden className="block">
              <span className="campo-cifra__antes">{t('metricasIA.aciertoAntes')}</span>
              <span className="campo-cifra__linea">
                <NumeroAnimado valor={String(aciertos)} className="campo-cifra__enorme" />
                <span className="campo-cifra__de">{t('metricasIA.aciertoDe')}</span>
              </span>
              <span className="campo-cifra__donde">{t(verificada ? 'metricasIA.aciertoEvaluacion' : 'metricasIA.aciertoMuestra')}</span>
            </span>
          </p>
          {!verificada && <p className="campo-cifra__sello">{t('metricasIA.muestraIlustrativa')}</p>}
        </div>

        {mirados.length > 0 && (
          <div className="campo-cifra__mirados">
            <h3 className="campo-cifra__rotulo">{t('metricasIA.loQueMasMira')}</h3>
            <ol>
              {mirados.map((variable) => (
                <li key={variable}>{variable}</li>
              ))}
            </ol>
          </div>
        )}
      </div>

      <div className="campo-cifra__pie">
        {/* Sin origen verificable, el valor es ilustrativo: se dice junto a la cifra, no en letra chica. */}
        {verificada ? (
          <Veredicto verificada cumple={cumple} contextoUmbral={contextoUmbral} />
        ) : (
          <div role="status" className="flex items-start gap-2.5">
            <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
            <p className="campo-cifra__aviso">{t('metricasIA.avisoDatosNoReportables')}</p>
          </div>
        )}
        <p className="text-[15px] leading-6 font-medium">{t('metricasIA.modoSombra')}</p>
      </div>
    </section>
  )
}

/** Las variables de mayor a menor. La barra compara entre sí: la más pesada llega al final de la pista. */
export function PesoVariables({
  importancias,
  etiqueta,
  porcentaje,
  verificada,
}: {
  importancias: Array<[string, number]>
  etiqueta: (variable: string) => string
  porcentaje: (valor: number) => string
  verificada: boolean
}) {
  const { t } = useTranslation()
  const mayor = importancias.reduce((tope, [, peso]) => Math.max(tope, peso), 0)
  return (
    <section id="variables-modelo" aria-labelledby="variables-modelo-titulo" className="pesos min-w-0">
      <TituloSeccion id="variables-modelo-titulo" verificada={verificada}>{t('metricasIA.importanciaVisible')}</TituloSeccion>
      <p className="sr-only">{t('metricasIA.variablesAyuda')}</p>
      <ol>
        {importancias.map(([variable, peso], i) => (
          <li key={variable} className="peso" data-destacado={i < VARIABLES_DESTACADAS}>
            <span className="peso__nombre break-words">{etiqueta(variable)}</span>
            <span className="peso__valor">{porcentaje(peso)}</span>
            <span
              className="peso__pista"
              role="img"
              aria-label={t('metricasIA.barraImportancia', { variable: etiqueta(variable), valor: porcentaje(peso) })}
            >
              <span
                className="peso__barra"
                style={{ '--peso': mayor > 0 ? Math.max(0, peso) / mayor : 0 } as CSSProperties}
              />
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-3 max-w-[62ch] text-xs leading-5 text-muted">{t('metricasIA.notaImportancias')}</p>
    </section>
  )
}

/** Filas: la situación real. Columnas: lo que asignó el modelo. Una tabla de verdad, celda por celda. */
export function MatrizConfusion({
  clases,
  matriz,
  entero,
  verificada,
}: {
  clases: string[]
  matriz: number[][]
  entero: (valor: number) => string
  verificada: boolean
}) {
  const { t } = useTranslation()
  const legible = matrizOrdenada(clases, matriz)
  const nombre = (clase: string) => t(`riesgo.${clase}`, { defaultValue: clase.replaceAll('_', ' ') })
  return (
    <section aria-labelledby="matriz-titulo" className="min-w-0">
      <TituloSeccion id="matriz-titulo" verificada={verificada}>{t('metricasIA.matrizTitulo')}</TituloSeccion>
      {legible ? (
        <>
          <p className="mt-3 mb-2 max-w-[62ch] text-[13px] leading-5 text-muted">{t('metricasIA.matrizAyuda')}</p>
          <table className="matriz">
            <caption className="sr-only">{t('metricasIA.matrizTitulo')}</caption>
            <thead>
              <tr>
                <td className="matriz__eje w-[27%] align-bottom">{t('metricasIA.matrizReal')}</td>
                <th colSpan={legible.clases.length} scope="colgroup" className="matriz__eje text-center!">
                  {t('metricasIA.matrizAsignada')}
                </th>
              </tr>
              <tr>
                <td />
                {legible.clases.map((clase) => (
                  <th key={clase} scope="col" className="matriz__clase">{nombre(clase)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {legible.filas.map((fila, real) => (
                <tr key={legible.clases[real]}>
                  <th scope="row" className="matriz__clase">{nombre(legible.clases[real])}</th>
                  {fila.map((casos, asignada) => (
                    <td
                      key={legible.clases[asignada]}
                      className="matriz__celda"
                      data-tipo={real === asignada ? 'acierto' : casos > 0 ? 'confusion' : 'vacia'}
                    >
                      {entero(casos)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {legible.clases.includes('excursion_critica') && (
            <p className="mt-2 max-w-[62ch] text-xs leading-5 text-muted">{t('metricasIA.matrizNotaCritica')}</p>
          )}
        </>
      ) : (
        <p className="mt-3 text-sm leading-5 text-muted">{t('metricasIA.matrizNoDisponible')}</p>
      )}
    </section>
  )
}

/** La forma de la pantalla mientras carga: sin una sola cifra, porque aún no hay ninguna. */
export function EsqueletoClasificador() {
  const { t } = useTranslation()
  return (
    <div role="status" className="flex flex-col gap-6">
      <span className="sr-only">{t('app.cargando')}</span>
      <div aria-hidden className="campo-cifra campo-cifra--esperando p-5 sm:p-8">
        <div className="esqueleto h-7 w-[min(100%,720px)] rounded" />
        <div className="esqueleto mt-3 h-7 w-[min(80%,520px)] rounded" />
        <div className="esqueleto mt-8 h-[clamp(64px,12vw,150px)] w-[min(100%,420px)] rounded-lg" />
        <div className="esqueleto mt-6 h-4 w-72 max-w-full rounded" />
      </div>
      <div aria-hidden className="esqueleto h-12 rounded-(--radius-card)" />
    </div>
  )
}
