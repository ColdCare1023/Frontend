import { lazy, Suspense, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BookOpen } from 'lucide-react'

import { useAuthStore } from '@/application/stores/authStore'
import { puedeAbrirRuta, ubicarRuta } from '@/presentation/navegacion'
import { Button } from '@/presentation/components/ui/button'
import { NativeSelect } from '@/presentation/components/ui/input'
import {
  SidePanel, SidePanelBody, SidePanelContent, SidePanelHeader, SidePanelTitle, SidePanelTrigger,
} from '@/presentation/components/ui/side-panel'

const Historial = lazy(() => import('../HistorialPage').then((m) => ({ default: m.HistorialPage })))
const Alertas = lazy(() => import('../AlertasPage').then((m) => ({ default: m.AlertasPage })))
const Reportes = lazy(() => import('../ReportesPage').then((m) => ({ default: m.ReportesPage })))
const Integridad = lazy(() => import('../TrazabilidadPage').then((m) => ({ default: m.TrazabilidadPage })))
const Clasificacion = lazy(() => import('../MetricasIAPage').then((m) => ({ default: m.MetricasIAPage })))
const Guia = lazy(() => import('../GuiaPage').then((m) => ({ default: m.GuiaPage })))

const RUTAS_CONSULTA = ['/historial', '/alertas', '/reportes', '/trazabilidad', '/metricas-ia', '/guia'] as const
type RutaConsulta = typeof RUTAS_CONSULTA[number]

export function ConsultasFarmacia({ equipoId }: { equipoId?: string | null }) {
  const { t } = useTranslation()
  const rol = useAuthStore((s) => s.usuario?.rol)
  const [abierto, setAbierto] = useState(false)
  const [seleccion, setSeleccion] = useState<RutaConsulta>('/historial')
  const [visitadas, setVisitadas] = useState<RutaConsulta[]>([])
  const permitidas = RUTAS_CONSULTA.flatMap((ruta) => {
    const destino = ubicarRuta(ruta)
    return destino && puedeAbrirRuta(rol, ruta) ? [{ ruta, item: destino.item }] : []
  })
  const actual = permitidas.find(({ ruta }) => ruta === seleccion) ?? permitidas[0]
  if (!actual) return null
  const activa = actual.ruta

  function elegir(ruta: RutaConsulta) {
    setVisitadas((previas) => previas.includes(activa) ? previas : [...previas, activa])
    setSeleccion(ruta)
  }

  return (
    <SidePanel open={abierto} onOpenChange={(valor) => {
      setAbierto(valor)
      if (!valor) setVisitadas([])
    }}>
      <SidePanelTrigger asChild>
        <Button type="button" variant="secondary" size="sm" aria-haspopup="dialog">
          <BookOpen aria-hidden />
          {t('consultasFarmacia.abrir')}
        </Button>
      </SidePanelTrigger>
      <SidePanelContent className="max-w-5xl" aria-describedby={undefined}>
        <SidePanelHeader className="space-y-3">
          <SidePanelTitle>{t('consultasFarmacia.abrir')}</SidePanelTitle>
          <label className="block sm:hidden">
            <span className="sr-only">{t('consultasFarmacia.elegir')}</span>
            <NativeSelect aria-label={t('consultasFarmacia.elegir')} value={activa} onChange={(e) => elegir(e.target.value as RutaConsulta)}>
              {permitidas.map(({ ruta, item }) => <option key={ruta} value={ruta}>{t(item.claveI18n)}</option>)}
            </NativeSelect>
          </label>
          <div role="group" aria-label={t('consultasFarmacia.elegir')} className="hidden flex-wrap gap-1 sm:flex">
            {permitidas.map(({ ruta, item }) => {
              const { claveI18n, icono: Icono } = item
              return (
                <Button key={ruta} type="button" variant={activa === ruta ? 'secondary' : 'ghost'}
                  size="sm" aria-pressed={activa === ruta} onClick={() => elegir(ruta)}>
                  <Icono aria-hidden />{t(claveI18n)}
                </Button>
              )
            })}
          </div>
        </SidePanelHeader>
        {permitidas.filter(({ ruta }) => ruta === activa || visitadas.includes(ruta)).map(({ ruta, item }) => (
          <SidePanelBody key={ruta} hidden={activa !== ruta} className="overscroll-contain bg-background px-3 py-3 sm:px-5">
            <section aria-label={t(item.claveI18n)}>
              <Suspense fallback={<p role="status" className="py-2 text-body text-muted">{t('app.cargando')}</p>}>
                {ruta === '/historial' && <Historial key={equipoId ?? ''} integrada equipoId={equipoId} />}
                {ruta === '/alertas' && <Alertas integrada />}
                {ruta === '/reportes' && <Reportes key={equipoId ?? ''} integrada equipoId={equipoId} />}
                {ruta === '/trazabilidad' && <Integridad integrada />}
                {ruta === '/metricas-ia' && <Clasificacion integrada />}
                {ruta === '/guia' && <Guia integrada />}
              </Suspense>
            </section>
          </SidePanelBody>
        ))}
      </SidePanelContent>
    </SidePanel>
  )
}
