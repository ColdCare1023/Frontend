import {
  BellOff,
  BellRing,
  Brain,
  CalendarClock,
  ClipboardCheck,
  ClipboardPen,
  Cpu,
  FileText,
  HardDrive,
  Hourglass,
  KeyRound,
  Link2,
  ListChecks,
  MapPin,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Thermometer,
  UserCheck,
  UserRound,
  UserX,
  Wifi,
  WifiOff,
  type LucideIcon,
} from 'lucide-react'

import type { RegistroTrazabilidad } from '@/domain/entities/RegistroTrazabilidad'

type Traductor = (clave: string, opciones?: Record<string, unknown>) => string

const EXACTOS: Record<string, LucideIcon> = {
  LECTURA_TERMICA: Thermometer,
  LECTURA_REGISTRADA: Thermometer,
  ALERTA_TERMICA: BellRing,
  ALERTA_CERRADA: BellOff,
  ACCION_CORRECTIVA: ClipboardCheck,
  ACCION_CORRECTIVA_RECTIFICADA: ClipboardPen,
  REPORTE_BPA: FileText,
  CHECKLIST_BPA: ListChecks,
  AUDITORIA: ScrollText,
  AUDIT_LOG: ScrollText,
  CONECTIVIDAD: Wifi,
  DISPOSITIVO_OFFLINE: WifiOff,
  SIN_DATOS: Hourglass,
  ALTA_DISPOSITIVO: HardDrive,
  BAJA_HARDWARE: HardDrive,
  CALIBRACION_SENSORES: CalendarClock,
  INSTALACION_DISPOSITIVO_ACTUALIZADA: MapPin,
  RESPONSABLE_DISPOSITIVO_ACTUALIZADO: UserRound,
  ACEPTACION_PRIVACIDAD: UserCheck,
  RECHAZO_PRIVACIDAD: UserX,
  DESACTIVACION_USUARIO: UserX,
  VERIFICACION_INTEGRIDAD: ShieldCheck,
  REGISTRO_AISLADO_CORRUPCION: ShieldAlert,
  CORRUPCION_CADENA_DETECTADA: ShieldAlert,
}

/**
 * Icono por tipo de evento (DIRECTION §14). Acompaña al nombre y nunca lo
 * sustituye; el color queda solo para el estado. Desconocido → `Link2`.
 */
export function iconoEvento(tipo: string): LucideIcon {
  if (EXACTOS[tipo]) return EXACTOS[tipo]
  if (/_CREDENCIAL_DISPOSITIVO$|^BROKER_/.test(tipo)) return KeyRound
  if (/^FIRMWARE_/.test(tipo)) return Cpu
  if (/^MODELO_IA_/.test(tipo)) return Brain
  return Link2
}

export function etiquetaEvento(tipo: string, t: Traductor): string {
  return t(`trazabilidad.eventos.${tipo}`, {
    defaultValue: tipo.replaceAll('_', ' ').toLocaleLowerCase().replace(/^\p{L}/u, (l) => l.toLocaleUpperCase()),
  })
}

const texto = (valor: unknown) => (typeof valor === 'string' || typeof valor === 'number' ? String(valor) : '')

/** Una línea con lo esencial del contenido del registro (subtítulo de la fila). */
export function resumenPayload(registro: RegistroTrazabilidad, t: Traductor): string {
  const p = registro.payload ?? {}
  const tipo = registro.tipo_evento
  if (tipo.startsWith('LECTURA')) {
    const temp = p.temperatura_interna
    const riesgo = p.riesgo_efectivo ?? p.nivel_riesgo
    if (typeof temp !== 'number') return ''
    return t('trazabilidad.resumenPayload.lectura', {
      temp: temp.toFixed(1),
      riesgo: typeof riesgo === 'string' ? t(`riesgo.${riesgo}`, { defaultValue: riesgo }) : '—',
    })
  }
  if (tipo.startsWith('ALERTA')) return texto(p.mensaje)
  if (tipo.startsWith('ACCION_CORRECTIVA')) return texto(p.descripcion)
  if (tipo === 'CONECTIVIDAD') return texto(p.estado)
  if (tipo === 'AUDITORIA' || tipo === 'AUDIT_LOG') {
    const accion = texto(p.accion)
    return accion ? t(`auditoria.eventos.${accion}`, { defaultValue: accion }) : ''
  }
  if (tipo === 'VERIFICACION_INTEGRIDAD') {
    const device = texto(p.device_id)
    if (!device) return ''
    return t('trazabilidad.resumenPayload.verificacion', {
      device,
      resultado: t(p.integra === false ? 'trazabilidad.segmento.resultadoRoto' : 'trazabilidad.segmento.resultadoIntegro'),
      n: texto(p.total_bloques_verificados) || '—',
    })
  }
  return ''
}
