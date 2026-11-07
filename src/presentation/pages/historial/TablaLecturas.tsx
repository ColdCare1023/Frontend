import { useTranslation } from 'react-i18next'
import { DoorClosed, DoorOpen, ShieldQuestion } from 'lucide-react'

import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import type { NivelRiesgo } from '@/domain/value-objects/NivelRiesgo'
import { localeActual } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { RiskBadge } from '../../components/RiskBadge'
import { Button } from '../../components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'

const RELLENO: Partial<Record<NivelRiesgo, string>> = {
  excursion_critica: 'bg-campo-critico text-campo-critico-tinta',
  riesgo_preventivo: 'bg-campo-preventivo text-campo-preventivo-tinta',
}

/** Hora de 24 h con segundos, como la frase y la curva: «14:06:27». */
function horaLectura(iso: string) {
  return new Date(iso).toLocaleTimeString(localeActual(), { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
}

function CifraLectura({ lectura }: { lectura: LecturaTermica }) {
  // HU-34: el historial también muestra el riesgo EFECTIVO, no la clase cruda de la IA.
  const relleno = lectura.riesgo_efectivo ? RELLENO[lectura.riesgo_efectivo] : undefined
  return (
    <span data-relleno={Boolean(relleno)} className={cn('cifra-lectura nums', relleno)}>
      {lectura.temperatura_interna?.toFixed(1) ?? '—'}
      <span className="cifra-lectura__unidad">°C</span>
    </span>
  )
}

/** Las lecturas con todos sus datos: hora, cifra, riesgo, equipo, ambiente, humedad, puerta y origen. */
export function TablaLecturas({
  titulo,
  lecturas,
  mostrarCabecera = true,
  onVerEvidencia,
}: {
  titulo: string
  lecturas: LecturaTermica[]
  /** Los nombres de columna se ven en la primera tabla; en las demás siguen para el lector de pantalla. */
  mostrarCabecera?: boolean
  onVerEvidencia: (lectura: LecturaTermica) => void
}) {
  const { t } = useTranslation()
  return (
    <Table titulo={titulo} className="lecturas-tabla min-w-0">
      {/* Los anchos van aquí y no en la cabecera: las tablas sin cabecera visible se alinean igual. */}
      <colgroup>
        <col className="w-[15%] lg:w-[14%]" />
        <col className="w-[16%]" />
        <col className="w-[21%] xl:w-[18%]" />
        <col className="w-[15%]" />
        <col className="w-[10%]" />
        <col className="w-[9%]" />
        <col className="w-[6%]" />
        <col className="w-[12%]" />
      </colgroup>
      <TableHeader className={cn(!mostrarCabecera && 'sr-only')}>
        <TableRow>
          <TableHead className="sm:px-2 xl:px-4">{t('comunes.hora')}</TableHead>
          <TableHead className="sm:px-2 xl:px-4">{t('historial.tempInterna')}</TableHead>
          <TableHead className="sm:px-2 xl:px-4">{t('historial.riesgo')}</TableHead>
          <TableHead className="sm:px-2 xl:px-4">{t('historial.codigoEquipo')}</TableHead>
          <TableHead numero className="sm:px-2 xl:px-4">{t('historial.tempAmbiental')}</TableHead>
          <TableHead numero className="sm:px-2 xl:px-4">{t('historial.humedad')}</TableHead>
          <TableHead className="text-center sm:px-1 xl:px-2">{t('historial.puerta')}</TableHead>
          <TableHead className="text-right sm:px-2 xl:px-4">{t('historial.evidenciaModelo')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lecturas.map((lectura) => (
          <TableRow key={lectura.id ?? `${lectura.device_id}-${lectura.timestamp}`}>
            <TableCell data-area="hora" className="nums whitespace-nowrap text-[13.5px] text-muted sm:px-2 xl:px-4">
              <time dateTime={lectura.timestamp}>{horaLectura(lectura.timestamp)}</time>
            </TableCell>
            <TableCell data-area="cifra" className="sm:px-2 xl:px-4">
              <CifraLectura lectura={lectura} />
            </TableCell>
            <TableCell data-area="riesgo" className="sm:px-2 xl:px-4">
              <RiskBadge nivel={lectura.riesgo_efectivo} />
            </TableCell>
            <TableCell data-area="equipo" className="truncate text-[13.5px] font-medium sm:px-2 xl:px-4">
              {lectura.device_id}
            </TableCell>
            <TableCell data-area="ambiente" numero className="whitespace-nowrap text-[13.5px] text-muted sm:px-2 xl:px-4">
              <span className="lecturas-tabla__rotulo block text-xs leading-4">{t('historial.tempAmbiental')}</span>
              {lectura.temperatura_ambiental?.toFixed(1) ?? '—'} °C
            </TableCell>
            <TableCell data-area="humedad" numero className="whitespace-nowrap text-[13.5px] text-muted sm:px-2 xl:px-4">
              <span className="lecturas-tabla__rotulo block text-xs leading-4">{t('historial.humedad')}</span>
              {lectura.humedad_ambiental?.toFixed(0) ?? '—'} %
            </TableCell>
            <TableCell data-area="puerta" className="sm:px-1 sm:text-center xl:px-2">
              <span className="lecturas-tabla__rotulo block text-xs leading-4 text-muted">{t('historial.puerta')}</span>
              {/* HU-35 criterio 4: si el dato de puerta no está disponible, null no es
                  "cerrada": se marca aparte para no fingir un dato. */}
              <span className="inline-flex align-middle">
                {lectura.apertura_refrigerador === null ? (
                  <ShieldQuestion role="img" className="size-4 text-muted" aria-label={t('dashboard.puertaSinSensor')} />
                ) : lectura.apertura_refrigerador ? (
                  <DoorOpen role="img" className="size-4 text-honey-700" aria-label={t('dashboard.puertaAbierta')} />
                ) : (
                  <DoorClosed role="img" className="size-4 text-muted" aria-label={t('dashboard.puertaCerrada')} />
                )}
              </span>
            </TableCell>
            <TableCell data-area="origen" className="text-right sm:px-2 xl:px-4">
              <Button variant="ghost" size="sm" className="-mr-2 px-2 text-primary sm:mr-0" disabled={!lectura.id} onClick={() => onVerEvidencia(lectura)}>
                {t('historial.verEvidencia')}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
