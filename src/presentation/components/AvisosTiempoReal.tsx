import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAuthStore } from '@/application/stores/authStore'
import { suscribirseTiempoReal, type TipoAvisoDispositivo } from '@/infrastructure/sse/sseClient'
import { notificarNotch } from './notificaciones/notificarNotch'

type Nivel = 'critico' | 'aviso' | 'ok'

interface Aviso {
  id: number
  nivel: Nivel
  texto: string
}

const DURACION_MS = 15_000
const MAXIMO_VISIBLES = 4
/** HU-44: el nodo reintenta con el token anterior; un aviso por equipo basta. */
const SILENCIO_FIRMA_INVALIDA_MS = 5 * 60_000

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
  // Solo el administrador puede cambiar la contraseña en la consola del broker.
  const esAdministrador = useAuthStore((s) => s.usuario?.rol === 'administrador')
  const administrador = useRef(esAdministrador)
  useEffect(() => {
    administrador.current = esAdministrador
  }, [esAdministrador])

  useEffect(() => {
    const firmaInvalidaAvisada = new Map<string, number>()
    const temporizadores = new Set<ReturnType<typeof setTimeout>>()
    const publicar = (nivel: Nivel, texto: string) => {
      const id = siguiente.current++
      setAvisos((previos) => [...previos, { id, nivel, texto }].slice(-MAXIMO_VISIBLES))
      // Lo visible es el notch (sileo); esta región solo lo anuncia al lector de pantalla.
      notificarNotch(nivel, { id: `aviso-${id}`, titulo: t(`avisosTiempoReal.titulo.${nivel}`), detalle: texto, duracion: DURACION_MS })
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
      // HU-44: la retención por compromiso no espera al sondeo del tablero.
      onIncidenteOperativo: (evento) => {
        if (evento.tipo === 'excursion_no_verificada') {
          const temperatura = evento.detalle?.temperatura_interna
          publicar('critico', t('avisosTiempoReal.excursion_no_verificada', {
            device: evento.device_id,
            temperatura: typeof temperatura === 'number' ? temperatura.toFixed(2) : '—',
          }))
        }
        if (evento.tipo === 'monitoreo_suspendido') {
          publicar('aviso', t('avisosTiempoReal.monitoreo_suspendido', { device: evento.device_id }))
        }
      },
      onPruebaPosesion: (resultado) => {
        if (resultado.verificada) {
          publicar('ok', t('avisosTiempoReal.posesion_verificada', { device: resultado.device_id }))
        } else if (resultado.motivo === 'firma_invalida' && administrador.current) {
          const ahora = Date.now()
          const previo = firmaInvalidaAvisada.get(resultado.device_id)
          if (previo !== undefined && ahora - previo < SILENCIO_FIRMA_INVALIDA_MS) return
          firmaInvalidaAvisada.set(resultado.device_id, ahora)
          publicar('critico', t('avisosTiempoReal.posesion_firma_invalida', { device: resultado.device_id }))
        }
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
      className="sr-only"
    >
      {avisos.map((aviso) => (
        <p key={aviso.id} role={aviso.nivel === 'critico' ? 'alert' : 'status'}>
          {aviso.texto}
        </p>
      ))}
    </div>
  )
}
