import {
  Bell,
  Brain,
  CalendarClock,
  ClipboardCheck,
  DatabaseBackup,
  DoorOpen,
  FileDown,
  HardDrive,
  Hourglass,
  KeyRound,
  ListChecks,
  Lock,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  ScrollText,
  ShieldAlert,
  ShieldX,
  Thermometer,
  TriangleAlert,
  UserCheck,
  UserCog,
  UserPlus,
  UserRound,
  UserX,
  Wifi,
  WifiOff,
  type LucideIcon,
} from 'lucide-react'

export type CategoriaAuditoria = 'acceso' | 'usuarios' | 'equipos' | 'alertas' | 'reportes' | 'ia' | 'integridad' | 'otros'

export const CATEGORIAS_AUDITORIA: readonly CategoriaAuditoria[] = [
  'acceso',
  'usuarios',
  'equipos',
  'alertas',
  'reportes',
  'ia',
  'integridad',
  'otros',
]

/**
 * Clasificación de los códigos de la bitácora (DIRECTION §14). Lista
 * ordenada: gana la primera expresión que coincide. Un código desconocido
 * cae en «Otras» con su nombre legible: nunca rompe la tabla.
 */
const REGLAS: ReadonlyArray<readonly [RegExp, CategoriaAuditoria, LucideIcon]> = [
  [/^LOGIN_/, 'acceso', LogIn],
  [/^LOGOUT$/, 'acceso', LogOut],
  [/^(PASSWORD_|RECUPERACION_|RESTABLECER_PASSWORD|CODIGO_|SEGUNDO_FACTOR)|_CODIGO/, 'acceso', KeyRound],
  [/^(BLOQUEO_TEMPORAL|UMBRAL_INTENTOS)/, 'acceso', Lock],
  [/^(RBAC_DENEGADO|SESION_RECHAZADA)$/, 'acceso', ShieldX],
  [/RETENCION_INTENTOS/, 'acceso', Lock],
  [/CREAR_USUARIO|USUARIO_CREADO/, 'usuarios', UserPlus],
  [/DESACTIVAR_USUARIO/, 'usuarios', UserX],
  [/REACTIVAR_USUARIO/, 'usuarios', UserCheck],
  [/CAMBIAR_ROL/, 'usuarios', UserCog],
  [/BIENVENIDA/, 'usuarios', Mail],
  [/(ALTA|BAJA)_DISPOSITIVO/, 'equipos', HardDrive],
  [/CREDENCIAL|POSESION|BROKER/, 'equipos', KeyRound],
  [/CALIBRACION/, 'equipos', CalendarClock],
  [/INSTALACION/, 'equipos', MapPin],
  [/RESPONSABLE/, 'equipos', UserRound],
  [/DISPOSITIVO_ONLINE/, 'equipos', Wifi],
  [/SIN_DATOS|MONITOREO_SUSPENDIDO/, 'equipos', Hourglass],
  [/^(LECTURA_|TELEMETRIA_|EVENTO_|LWT_|INTERVALO_)/, 'equipos', Thermometer],
  // HU-04/HU-35: cambio de puerta; HU-08/HU-13: reconexión y desconexión del nodo.
  [/^PUERTA$/, 'equipos', DoorOpen],
  [/^WIFI_RECONEXION/, 'equipos', Wifi],
  [/^DESCONEXION_ORDENADA$/, 'equipos', WifiOff],
  // HU-52/HU-54: avisos por correo de alertas e incidentes.
  [/^NOTIFICACION_/, 'alertas', Mail],
  [/EXCURSION_NO_VERIFICADA/, 'alertas', TriangleAlert],
  [/ACCION_CORRECTIVA/, 'alertas', ClipboardCheck],
  [/ALERTA/, 'alertas', Bell],
  [/REPORTE_BPA|^EXPORTAR_BITACORA$/, 'reportes', FileDown],
  [/CHECKLIST_BPA/, 'reportes', ListChecks],
  [/MODELO|INFERENCIA/, 'ia', Brain],
  [/CADENA_CORRUPCION/, 'integridad', ShieldAlert],
  // HU-29: respaldo programado de la base (evidencia recuperable).
  [/^RESPALDO_(COMPLETADO|FALLIDO)$/, 'integridad', DatabaseBackup],
]

export interface ClasificacionAuditoria {
  categoria: CategoriaAuditoria
  icono: LucideIcon
}

export function clasificarAccion(codigo: string): ClasificacionAuditoria {
  for (const [patron, categoria, icono] of REGLAS) {
    if (patron.test(codigo)) return { categoria, icono }
  }
  return { categoria: 'otros', icono: ScrollText }
}

export const ICONO_CATEGORIA: Record<CategoriaAuditoria, LucideIcon> = {
  acceso: LogIn,
  usuarios: UserCog,
  equipos: HardDrive,
  alertas: Bell,
  reportes: FileDown,
  ia: Brain,
  integridad: ShieldAlert,
  otros: ScrollText,
}

/** Nombre legible de un código de la bitácora (traducción o fallback humanizado). */
export function nombreAccion(codigo: string, t: (clave: string, opciones?: Record<string, unknown>) => string): string {
  return t(`auditoria.eventos.${codigo}`, {
    defaultValue: codigo
      .toLocaleLowerCase()
      .replaceAll('_', ' ')
      .replace(/^\p{L}/u, (letra) => letra.toLocaleUpperCase()),
  })
}

/**
 * HU-50: códigos de seguridad que el backend registra (para sugerirlos en el
 * filtro de acción, que en el backend es por código exacto). El bloqueo por
 * intentos es UMBRAL_INTENTOS_FALLIDOS_EXCEDIDO: el backend nunca emitió
 * BLOQUEO_TEMPORAL.
 */
export const CODIGOS_SEGURIDAD: readonly string[] = [
  'LOGIN_FALLIDO',
  'LOGIN_CODIGO_FALLIDO',
  'LOGIN_GOOGLE_FALLIDO',
  'UMBRAL_INTENTOS_FALLIDOS_EXCEDIDO',
  'RBAC_DENEGADO',
  'SESION_RECHAZADA',
  'EXPORTAR_BITACORA',
]

/** Fallida, denegada o bloqueada: todo lo que no fue `exitoso`. */
export const esFallida = (r: { resultado?: string | null }) => Boolean(r.resultado && r.resultado !== 'exitoso')
