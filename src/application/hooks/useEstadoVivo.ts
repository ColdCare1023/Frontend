import { useEffect } from 'react'

import {
  aEquipoVivo,
  aplicarLectura,
  resumirAlertas,
  useEstadoVivoStore,
  type CargaVivo,
  type LecturaVivo,
} from '@/application/stores/estadoVivoStore'
import type { AlertaTermica } from '@/domain/entities/AlertaTermica'
import type { Dispositivo } from '@/domain/entities/Dispositivo'
import { estadoRiesgoDe, type LecturaTermica } from '@/domain/entities/LecturaTermica'
import { apiClient } from '@/infrastructure/api/apiClient'
import { suscribirseTiempoReal } from '@/infrastructure/sse/sseClient'

const SONDEO_MS = 30_000
const AGRUPAR_MS = 400
const MAX_LECTURAS_EN_PARALELO = 8

function aLecturaVivo(l: LecturaTermica): LecturaVivo {
  // HU-34: además del riesgo, el estado a rotular (una lectura sin clasificación IA no es «Normal»).
  return { temperatura: l.temperatura_interna, riesgo: l.riesgo_efectivo ?? l.nivel_riesgo, estadoRiesgo: estadoRiesgoDe(l), timestamp: l.timestamp }
}

/**
 * Único alimentador del estado en vivo (montado una vez en AppLayout). Usa
 * solo endpoints que las pantallas ya consultan y que los 4 roles pueden
 * leer: `estado-operativo`, `alertas` (sin atender) y la última lectura por
 * equipo. Nunca lanza: un fallo deja la píldora en «parcial» o «error».
 */
export function useFuenteEstadoVivo() {
  useEffect(() => {
    let vivo = true
    const store = useEstadoVivoStore
    const temporizadores = new Set<number>()

    const consultarEquipos = async () => {
      const { data } = await apiClient.get<Dispositivo[]>('/api/dispositivos/estado-operativo', { params: { todos: true } })
      const activos = data.filter((d) => d.activo !== false && !d.dado_de_baja_en)
      if (vivo) store.setState({ equipos: activos.map(aEquipoVivo), actualizadoEn: Date.now() })
      return activos
    }

    const consultarAlertas = async () => {
      try {
        const paginas = await Promise.all(
          ['pendiente', 'reconocida'].map((estado) =>
            apiClient.get<AlertaTermica[]>('/api/alertas', { params: { estado, limite: '200' } }).then((r) => r.data),
          ),
        )
        if (vivo) store.setState({ alertas: resumirAlertas(paginas) })
        return true
      } catch {
        if (vivo) store.setState({ alertas: null })
        return false
      }
    }

    const consultarUltimas = async (ids: string[]) => {
      let fallos = 0
      for (let i = 0; i < ids.length; i += MAX_LECTURAS_EN_PARALELO) {
        const lote = ids.slice(i, i + MAX_LECTURAS_EN_PARALELO)
        const resultados = await Promise.allSettled(
          lote.map((id) =>
            apiClient.get<LecturaTermica[]>('/api/lecturas', { params: { device_id: id, limite: 1 } }).then((r) => r.data),
          ),
        )
        if (!vivo) return fallos
        let ultimas = store.getState().ultimas
        resultados.forEach((resultado, j) => {
          if (resultado.status === 'rejected') {
            fallos += 1
            return
          }
          const reciente = resultado.value.reduce<LecturaTermica | null>(
            (mejor, l) => (!mejor || l.timestamp > mejor.timestamp ? l : mejor),
            null,
          )
          if (reciente) ultimas = aplicarLectura(ultimas, lote[j], aLecturaVivo(reciente))
        })
        store.setState({ ultimas })
      }
      return fallos
    }

    const cargar = async () => {
      const [equipos, alertasOk] = await Promise.all([consultarEquipos().catch(() => null), consultarAlertas()])
      const fallosLecturas = equipos ? await consultarUltimas(equipos.map((e) => e.id)) : 0
      if (!vivo) return
      const carga: CargaVivo =
        !equipos && !alertasOk ? 'error' : !equipos || !alertasOk || fallosLecturas > 0 ? 'parcial' : 'listo'
      store.setState({ carga })
    }

    const agrupar = (fn: () => void) => {
      let id: number | null = null
      return () => {
        if (id !== null) return
        id = window.setTimeout(() => {
          temporizadores.delete(id!)
          id = null
          fn()
        }, AGRUPAR_MS)
        temporizadores.add(id)
      }
    }
    const refrescarEquipos = agrupar(() => void consultarEquipos().catch(() => undefined))
    const refrescarAlertas = agrupar(() => void consultarAlertas())

    store.getState().registrar({ refrescar: () => void cargar(), refrescarAlertas })
    void cargar()

    const cancelar = suscribirseTiempoReal({
      onEstado: (conectado, motivo) => vivo && store.setState({ conectado, motivoDesconexion: conectado ? null : (motivo ?? null) }),
      onLectura: (lectura) => {
        if (!vivo) return
        const { ultimas } = store.getState()
        const siguiente = aplicarLectura(ultimas, lectura.device_id, aLecturaVivo(lectura))
        if (siguiente !== ultimas) store.setState({ ultimas: siguiente, actualizadoEn: Date.now() })
      },
      onConectividad: (cambio) => {
        if (!vivo) return
        store.setState({
          equipos: store.getState().equipos.map((e) => (e.id === cambio.device_id ? { ...e, conectividad: cambio.estado } : e)),
        })
      },
      onIncidenteOperativo: refrescarEquipos,
      onAlerta: refrescarAlertas,
    })

    // Sondeo solo con la pestaña visible: nada de trabajo en segundo plano.
    const sondeo = window.setInterval(() => {
      if (document.visibilityState === 'visible') refrescarEquipos()
    }, SONDEO_MS)
    const alVolver = () => {
      if (document.visibilityState !== 'visible') return
      refrescarEquipos()
      refrescarAlertas()
    }
    document.addEventListener('visibilitychange', alVolver)

    return () => {
      vivo = false
      window.clearInterval(sondeo)
      temporizadores.forEach((id) => window.clearTimeout(id))
      document.removeEventListener('visibilitychange', alVolver)
      cancelar()
      store.getState().reiniciar()
    }
  }, [])
}
