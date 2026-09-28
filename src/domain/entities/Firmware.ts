export interface FirmwareRelease {
  id: string
  version: string
  hash_sha256: string
  descripcion: string
  fecha_compilacion: string
}

export interface FirmwareDespliegue {
  id: string
  device_id: string
  version_objetivo: string
  estado: 'programado' | 'exitoso' | 'fallido'
  programado_para: string | null
  resultado: string | null
  completado_en: string | null
}
