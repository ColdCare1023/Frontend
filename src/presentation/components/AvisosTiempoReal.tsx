import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, CheckCircle2, WifiOff, X } from 'lucide-react'

import { suscribirseTiempoReal, type TipoAvisoDispositivo } from '@/infrastructure/sse/sseClient'
import { cn } from '@/lib/utils'

type Nivel = 'critico' | 'aviso' | 'ok'

interface Aviso {
  id: number
  nivel: Nivel
  texto: string
}

const DURACION_MS = 15_000
const MAXIMO_VISIBLES = 4

/** Avisos de dispositivo que merecen interrumpir; los nombres heredados se unifican. */
const AVISOS_DISPOSITIVO: Partial<Record<TipoAvisoDispositivo, { clave: string; nivel: Nivel }>> = {
  buffer_80: { clave: 'buffer_80', nivel: 'aviso' },
  capacidad_buffer_alta: { clave: 'buffer_80', nivel: 'aviso' },
  buffer_saturado: { clave: 'buffer_saturado', nivel: 'critico' },
  saturacion_buffer: { clave: 'buffer_saturado', nivel: 'critico' },
  registros_en_cuarentena: { clave: 'registros_en_cuarentena', nivel: 'aviso' },
  wifi_reconexion_prolongada: { clave: 'wifi_reconexion_prolongada', nivel: 'aviso' },
  reconexion_prolongada: { clave: 'wifi_reconexion_prolongada', nivel: 'aviso' },
  conmutacion_respaldo: { clave: 'conmutacion_respaldo', nivel: 'aviso' },
  suministro_restablecido: { clave: 'suministro_restablecido', nivel: 'ok' },
  respaldo_autonomia_critica: { clave: 'respaldo_autonomia_critica', nivel: 'critico' },
  respaldo_bajo: { clave: 'respaldo_autonomia_critica', nivel: 'critico' },
  credencial_rotada: { clave: 'credencial_rotada', nivel: 'ok' },
  // IOT-002: alguien usó la consola serie del nodo.
  config_modificada: { clave: 'config_modificada', nivel: 'aviso' },
  reinicio_manual: { clave: 'reinicio_manual', nivel: 'aviso' },
  consola_desbloqueada: { clave: 'consola_desbloqueada', nivel: 'aviso' },
  consola_desbloqueo_fallido: { clave: 'consola_desbloqueo_fallido', nivel: 'critico' },
  // IOT-004: solo el nodo da por instalada (o no) una versión enviada por OTA.
  ota_confirmada: { clave: 'ota_confirmada', nivel: 'ok' },
  ota_rechazada: { clave: 'ota_rechazada', nivel: 'aviso' },
  ota_fallida: { clave: 'ota_fallida', nivel: 'critico' },
  ota_revertida: { clave: 'ota_revertida', nivel: 'critico' },
}

/**
 * FE-008: avisos visibles de lo que llega por SSE y no es una lectura:
 * alertas, recuperaciones, desconexiones del nodo (LWT) y estado del buffer.
 * Una desconexión deliberada del dispositivo se ve al instante, sin esperar
 * al sondeo del estado operativo (NIST IR 8259A, "state awareness").
 */
export function AvisosTiempoReal() {
  const { t } = useTranslation()
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const siguiente = useRef(1)

  useEffect(() => {
    const temporizadores = new Set<ReturnType<typeof setTimeout>>()
    const publicar = (nivel: Nivel, texto: string) => {
      const id = siguiente.current++
      setAvisos((previos) => [...previos, { id, nivel, texto }].slice(-MAXIMO_VISIBLES))
      const temporizador = setTimeout(() => {
        temporizadores.delete(temporizador)
        setAvisos((previos) => previos.filter((aviso) => aviso.id !== id))
      }, DURACION_MS)
      temporizadores.add(temporizador)
    }

    const cerrar = suscribirseTiempoReal({
      onAlerta: (evento) => {
        if (evento.tipo === 'alerta') publicar('critico', t('avisosTiempoReal.alerta', { device: evento.device_id }))
        if (evento.tipo === 'recuperacion') publicar('ok', t('avisosTiempoReal.recuperacion', { device: evento.device_id }))
      },
      onConectividad: (cambio) => {
        if (cambio.estado === 'offline') publicar('critico', t('avisosTiempoReal.desconexion', { device: cambio.device_id }))
      },
      onAvisoDispositivo: (aviso) => {
        const definicion = AVISOS_DISPOSITIVO[aviso.tipo]
        if (definicion) {
          publicar(
            definicion.nivel,
            t(`avisosTiempoReal.${definicion.clave}`, {
              device: aviso.device_id,
              clave: String(aviso.detalle?.clave ?? ''),
              version: String(aviso.detalle?.firmware_version ?? aviso.detalle?.version ?? ''),
            }),
          )
        }
      },
    })
    return () => {
      cerrar()
      temporizadores.forEach(clearTimeout)
    }
  }, [t])

  return (
    <div
      // aria-label solo vale en un elemento con rol (axe: aria-prohibited-attr).
      role="region"
      aria-live="polite"
      aria-label={t('avisosTiempoReal.region')}
      className="pointer-events-none fixed right-4 bottom-4 z-40 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
    >
      {avisos.map((aviso) => (
        <div
          key={aviso.id}
          role={aviso.nivel === 'critico' ? 'alert' : 'status'}
          className={cn(
            'pointer-events-auto flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm shadow-(--shadow-raised)',
            aviso.nivel === 'critico' && 'border-clay-200 bg-clay-100 text-clay-700',
            aviso.nivel === 'aviso' && 'border-amber-300 bg-amber-50 text-amber-900',
            aviso.nivel === 'ok' && 'border-success-600/30 bg-success-100 text-success-700',
          )}
        >
          {aviso.nivel === 'ok' ? (
            <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0" />
          ) : aviso.nivel === 'critico' ? (
            <WifiOff aria-hidden className="mt-0.5 size-4 shrink-0" />
          ) : (
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
          )}
          <p className="flex-1">{aviso.texto}</p>
          <button
            type="button"
            aria-label={t('avisosTiempoReal.cerrar')}
            onClick={() => setAvisos((previos) => previos.filter((a) => a.id !== aviso.id))}
            className="rounded-sm p-0.5 opacity-70 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-current cursor-pointer"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
