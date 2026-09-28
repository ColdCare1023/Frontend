import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DownloadCloud, PackagePlus } from 'lucide-react'

import { fechaHora } from '@/lib/formato'
import { useFirmware } from '@/application/hooks/useFirmware'
import type { FirmwareDespliegue } from '@/domain/entities/Firmware'
import { rangoPagina } from '@/lib/paginacion'
import { Paginacion } from '../components/Paginacion'
import { PageHeader } from '../components/PageHeader'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../components/ui/dialog'
import { Input, Label } from '../components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'

const RELEASE_INICIAL = { version: '', hashSha256: '', descripcion: '' }
const DESPLIEGUE_INICIAL = { deviceId: '', versionObjetivo: '' }

const VARIANTE_ESTADO = {
  programado: 'neutral',
  exitoso: 'ok',
  fallido: 'critical',
} as const

export function FirmwarePage() {
  const { t } = useTranslation()
  const { releases, cargando, prepararRelease, programarDespliegue, ejecutarDespliegue } = useFirmware()
  const [pagina, setPagina] = useState(1)
  // Solo se pinta la página visible: estas listas crecen sin techo.
  const visibles = useMemo(() => releases.slice(...rangoPagina(pagina)), [releases, pagina])

  const [dialogoRelease, setDialogoRelease] = useState(false)
  const [formRelease, setFormRelease] = useState(RELEASE_INICIAL)
  const [formDespliegue, setFormDespliegue] = useState(DESPLIEGUE_INICIAL)
  const [despliegueActual, setDespliegueActual] = useState<FirmwareDespliegue | null>(null)
  const [procesando, setProcesando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  const enviarRelease = async (event: React.FormEvent) => {
    event.preventDefault()
    setProcesando(true)
    setMensaje(null)
    const resultado = await prepararRelease(formRelease.version, formRelease.hashSha256, formRelease.descripcion)
    setProcesando(false)

    if (resultado === 'ok') {
      setMensaje({ tipo: 'ok', texto: t('firmware.releaseCreada') })
      setTimeout(() => {
        setDialogoRelease(false)
        setFormRelease(RELEASE_INICIAL)
        setMensaje(null)
      }, 1000)
    } else if (resultado === 'duplicado') {
      setMensaje({ tipo: 'error', texto: t('firmware.errorDuplicado') })
    } else {
      setMensaje({ tipo: 'error', texto: t('comunes.error') })
    }
  }

  const enviarDespliegue = async (event: React.FormEvent) => {
    event.preventDefault()
    setProcesando(true)
    setMensaje(null)
    const resultado = await programarDespliegue(formDespliegue.deviceId, formDespliegue.versionObjetivo)
    setProcesando(false)

    if (resultado === 'downgrade') {
      setMensaje({ tipo: 'error', texto: t('firmware.errorDowngrade') })
    } else if (resultado === 'no_encontrado') {
      setMensaje({ tipo: 'error', texto: t('firmware.errorNoEncontrado') })
    } else if (resultado === 'error') {
      setMensaje({ tipo: 'error', texto: t('comunes.error') })
    } else {
      setDespliegueActual(resultado)
      setMensaje({ tipo: 'ok', texto: t('firmware.despliegueProgramado') })
    }
  }

  const ejecutar = async () => {
    if (!despliegueActual) return
    setProcesando(true)
    const resultado = await ejecutarDespliegue(despliegueActual.id)
    setProcesando(false)
    if (resultado !== 'error') setDespliegueActual(resultado)
  }

  return (
    <div>
      <PageHeader
        eyebrow={t('nav.seccionAdministracion')}
        titulo={t('firmware.titulo')}
        descripcion={t('firmware.descripcion')}
      >
        <Button onClick={() => setDialogoRelease(true)}>
          <PackagePlus />
          {t('firmware.nuevaRelease')}
        </Button>
      </PageHeader>

      {/* ── Programar despliegue ─────────────────────────────── */}
      <div className="mb-6 animate-rise rounded-(--radius-card) border border-border bg-surface p-4 shadow-(--shadow-card)">
        <p className="mb-3 text-sm font-semibold text-foreground">{t('firmware.programarDespliegue')}</p>
        <form onSubmit={enviarDespliegue} className="flex flex-wrap items-end gap-3">
          <div className="min-w-40">
            <Label htmlFor="f-device">{t('firmware.deviceId')}</Label>
            <Input
              id="f-device"
              required
              value={formDespliegue.deviceId}
              onChange={(e) => setFormDespliegue({ ...formDespliegue, deviceId: e.target.value })}
            />
          </div>
          <div className="min-w-32">
            <Label htmlFor="f-version">{t('firmware.versionObjetivo')}</Label>
            <Input
              id="f-version"
              required
              placeholder="1.2.0"
              value={formDespliegue.versionObjetivo}
              onChange={(e) => setFormDespliegue({ ...formDespliegue, versionObjetivo: e.target.value })}
            />
          </div>
          <Button type="submit" disabled={procesando}>
            <DownloadCloud />
            {t('firmware.programar')}
          </Button>
        </form>

        {mensaje && (
          <p
            role={mensaje.tipo === 'error' ? 'alert' : 'status'}
            className={
              mensaje.tipo === 'ok'
                ? 'mt-3 rounded-(--radius-field) bg-success-100 px-3 py-2 text-[13px] text-success-700'
                : 'mt-3 rounded-(--radius-field) bg-clay-100 px-3 py-2 text-[13px] text-clay-700'
            }
          >
            {mensaje.texto}
          </p>
        )}

        {despliegueActual && (
          <div className="mt-3 flex items-center gap-3 rounded-(--radius-field) border border-border bg-cream-100/60 px-3 py-2">
            <Badge variant={VARIANTE_ESTADO[despliegueActual.estado]}>
              {t(`firmware.estados.${despliegueActual.estado}`)}
            </Badge>
            <span className="text-[13px] text-muted">
              {despliegueActual.device_id} → {despliegueActual.version_objetivo}
            </span>
            {despliegueActual.estado === 'programado' && (
              <Button size="sm" variant="secondary" className="ml-auto" onClick={() => void ejecutar()} disabled={procesando}>
                {t('firmware.ejecutar')}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ── Releases ─────────────────────────────────────────── */}
      <div className="animate-rise" style={{ animationDelay: '60ms' }}>
        <Table titulo={t('firmware.titulo')} cargando={cargando}>
          <TableHeader>
            <TableRow>
              <TableHead>{t('firmware.version')}</TableHead>
              <TableHead>{t('firmware.hash')}</TableHead>
              <TableHead>{t('firmware.columnaDescripcion')}</TableHead>
              <TableHead>{t('firmware.fechaCompilacion')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cargando ? (
              <TableEmpty colSpan={4}>{t('app.cargando')}</TableEmpty>
            ) : releases.length === 0 ? (
              <TableEmpty colSpan={4}>
                <span className="inline-flex flex-col items-center gap-2">
                  <PackagePlus className="size-5 text-faint" aria-hidden />
                  {t('firmware.sinReleases')}
                </span>
              </TableEmpty>
            ) : (
              visibles.map((release) => (
                <TableRow key={release.id}>
                  <TableCell className="font-medium">{release.version}</TableCell>
                  <TableCell className="nums text-xs text-muted">
                    {release.hash_sha256.slice(0, 12)}…
                    {/* El hash completo estaba solo en `title`, que el teclado
                        no alcanza. Es el dato que se coteja al validar una
                        release, así que tiene que ser recuperable. */}
                    <span className="sr-only">{release.hash_sha256}</span>
                  </TableCell>
                  <TableCell className="text-[13px]">{release.descripcion}</TableCell>
                  <TableCell className="nums text-[13px] text-muted">
                    {fechaHora(release.fecha_compilacion)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <Paginacion total={releases.length} pagina={pagina} onCambiar={setPagina} />
      </div>

      <Dialog open={dialogoRelease} onOpenChange={setDialogoRelease}>
        <DialogContent>
          <DialogTitle>{t('firmware.nuevaRelease')}</DialogTitle>
          <DialogDescription>{t('firmware.descripcion')}</DialogDescription>
          <form onSubmit={enviarRelease} className="mt-4 space-y-3">
            <div>
              <Label htmlFor="r-version">{t('firmware.version')}</Label>
              <Input
                id="r-version"
                required
                placeholder="1.2.0"
                value={formRelease.version}
                onChange={(e) => setFormRelease({ ...formRelease, version: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="r-hash">{t('firmware.hash')} (SHA-256)</Label>
              <Input
                id="r-hash"
                required
                minLength={64}
                maxLength={64}
                value={formRelease.hashSha256}
                onChange={(e) => setFormRelease({ ...formRelease, hashSha256: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="r-descripcion">{t('firmware.columnaDescripcion')}</Label>
              <Input
                id="r-descripcion"
                required
                value={formRelease.descripcion}
                onChange={(e) => setFormRelease({ ...formRelease, descripcion: e.target.value })}
              />
            </div>

            {mensaje && dialogoRelease && (
              <p
                role={mensaje.tipo === 'error' ? 'alert' : 'status'}
                className={
                  mensaje.tipo === 'ok'
                    ? 'rounded-(--radius-field) bg-success-100 px-3 py-2 text-[13px] text-success-700'
                    : 'rounded-(--radius-field) bg-clay-100 px-3 py-2 text-[13px] text-clay-700'
                }
              >
                {mensaje.texto}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setDialogoRelease(false)} disabled={procesando}>
                {t('usuarios.cancelar')}
              </Button>
              <Button type="submit" disabled={procesando}>
                {procesando ? t('dispositivos.procesando') : t('firmware.crear')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
