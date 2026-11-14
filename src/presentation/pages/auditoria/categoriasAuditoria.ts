import {
  Bell,
  Brain,
  CalendarClock,
  ClipboardCheck,
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
  [/^RBAC_DENEGADO$/, 'acceso', ShieldX],
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
  [/EXCURSION_NO_VERIFICADA/, 'alertas', TriangleAlert],
  [/ACCION_CORRECTIVA/, 'alertas', ClipboardCheck],
  [/ALERTA/, 'alertas', Bell],
  [/REPORTE_BPA/, 'reportes', FileDown],
  [/CHECKLIST_BPA/, 'reportes', ListChecks],
  [/MODELO|INFERENCIA/, 'ia', Brain],
  [/CADENA_CORRUPCION/, 'integridad', ShieldAlert],
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

/** Fallida, denegada o bloqueada: todo lo que no fue `exitoso`. */
export const esFallida = (r: { resultado?: string | null }) => Boolean(r.resultado && r.resultado !== 'exitoso')
