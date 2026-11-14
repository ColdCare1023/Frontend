import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CircleCheck, Eye, EyeOff, KeyRound } from 'lucide-react'

import type { ResultadoCrear } from '@/application/hooks/useUsuarios'
import type { Usuario } from '@/domain/entities/Usuario'
import { problemaPassword } from '@/domain/value-objects/politicaPassword'
import { ROLES, type Rol } from '@/domain/value-objects/Rol'
import { generarPasswordProvisional } from '@/lib/passwordProvisional'
import { Button } from '../../components/ui/button'
import { Detalles } from '../../components/ui/detalles'
import { Input, Label, NativeSelect } from '../../components/ui/input'
import {
  SidePanel,
  SidePanelBody,
  SidePanelContent,
  SidePanelDescription,
  SidePanelFooter,
  SidePanelHeader,
  SidePanelTitle,
} from '../../components/ui/side-panel'
import { StepperEstatico } from '../../components/ui/stepper'
import { MensajeFormulario } from './MensajeFormulario'

const FORM_INICIAL = { nombre: '', email: '', telefono: '', password: '', rol: 'tecnico' as Rol }

type Crear = (nombre: string, email: string, password: string, rol: Rol, telefono?: string) => Promise<ResultadoCrear | 'ok' | 'duplicado' | 'error'>

/** Normaliza el valor heredado (`'ok'` como cadena) al resultado con datos. */
function normalizar(r: Awaited<ReturnType<Crear>> | undefined): ResultadoCrear {
  if (r === 'ok') return { estado: 'ok', usuario: null, activacion: null }
  if (r === 'duplicado' || r === 'error') return { estado: r }
  return r ?? { estado: 'error' }
}

interface Exito {
  nombre: string
  email: string
  rol: Rol
  password: string
  activacion: boolean | null
}

/**
 * Alta de usuario en panel lateral (Cult UI Side Panel). Tras crear, el
 * mismo panel explica la activación por correo: el backend emite un código
 * de 48 h y la persona elige su contraseña; la provisional solo se muestra
 * si el correo no se confirmó.
 */
export function PanelNuevoUsuario({
  abierto,
  onAbiertoChange,
  crear,
  onCreado,
}: {
  abierto: boolean
  onAbiertoChange: (abierto: boolean) => void
  crear: Crear
  onCreado: (usuario: Usuario | null, email: string) => void
}) {
  const { t } = useTranslation()
  const [form, setForm] = useState(FORM_INICIAL)
  const [visible, setVisible] = useState(false)
  const [creando, setCreando] = useState(false)
  const [errorCampo, setErrorCampo] = useState<{ campo: 'email' | 'password'; texto: string } | null>(null)
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [anuncio, setAnuncio] = useState('')
  const [exito, setExito] = useState<Exito | null>(null)
  const [copiado, setCopiado] = useState(false)
  const nombreRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const exitoRef = useRef<HTMLHeadingElement>(null)

  const reiniciar = () => {
    setForm(FORM_INICIAL)
    setVisible(false)
    setErrorCampo(null)
    setErrorGeneral(null)
    setExito(null)
    setCopiado(false)
    setAnuncio('')
  }

  const cambiarAbierto = (siguiente: boolean) => {
    if (!siguiente) reiniciar()
    onAbiertoChange(siguiente)
  }

  const enviar = async (event: React.FormEvent) => {
    event.preventDefault()
    setErrorGeneral(null)
    const problema = problemaPassword(form.password)
    if (problema) {
      setErrorCampo({ campo: 'password', texto: t(`restablecerContrasena.politica.${problema}`) })
      passwordRef.current?.focus()
      return
    }
    setErrorCampo(null)
    setCreando(true)
    const resultado = normalizar(await crear(form.nombre, form.email, form.password, form.rol, form.telefono.trim() || undefined))
    setCreando(false)
    if (resultado.estado === 'ok') {
      setExito({ nombre: form.nombre, email: form.email, rol: form.rol, password: form.password, activacion: resultado.activacion })
      onCreado(resultado.usuario, form.email)
      requestAnimationFrame(() => exitoRef.current?.focus())
    } else if (resultado.estado === 'duplicado') {
      setErrorCampo({ campo: 'email', texto: t('usuarios.errorDuplicado') })
      emailRef.current?.focus()
    } else if (resultado.estado === 'politica') {
      setErrorCampo({ campo: 'password', texto: t('usuarios.errorPolitica') })
      passwordRef.current?.focus()
    } else {
      setErrorGeneral(t('comunes.error'))
    }
  }

  const generar = () => {
    setForm((f) => ({ ...f, password: generarPasswordProvisional() }))
    setVisible(true)
    setErrorCampo((e) => (e?.campo === 'password' ? null : e))
    setAnuncio(t('usuarios.passwordGenerada'))
  }

  const copiar = async () => {
    if (!exito) return
    try {
      await navigator.clipboard.writeText(exito.password)
      setCopiado(true)
    } catch {
      setCopiado(false)
    }
  }

  const errorEmail = errorCampo?.campo === 'email' ? errorCampo.texto : null
  const errorPassword = errorCampo?.campo === 'password' ? errorCampo.texto : null

  return (
    <SidePanel open={abierto} onOpenChange={cambiarAbierto}>
      <SidePanelContent
        className="sm:max-w-[480px]"
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          nombreRef.current?.focus()
        }}
      >
        <SidePanelHeader>
          <SidePanelTitle>{t('usuarios.nuevo')}</SidePanelTitle>
          <SidePanelDescription>{t('usuarios.nuevoDescripcion')}</SidePanelDescription>
        </SidePanelHeader>

        {exito ? (
          <>
            <SidePanelBody key="exito" className="panel-eje-x space-y-4" style={{ '--dir': 1 } as React.CSSProperties}>
              <p role="status" className="flex items-center gap-2 text-body text-success-700">
                <CircleCheck aria-hidden className="size-4" />
                {t('usuarios.creado')}
              </p>
              <div>
                <h3 ref={exitoRef} tabIndex={-1} className="text-title text-foreground outline-none">
                  {t('usuarios.exito.titulo', { nombre: exito.nombre })}
                </h3>
                <p className="text-meta text-muted">
                  {exito.email} · {t(`roles.${exito.rol}`)}
                </p>
              </div>
              <StepperEstatico
                pasos={[
                  exito.activacion === false
                    ? { id: 'entrega', titulo: t('usuarios.exito.pasoPasswordProvisional'), estado: 'hecho' }
                    : { id: 'correo', titulo: t('usuarios.exito.pasoCorreo'), estado: 'hecho' },
                  { id: 'codigo', titulo: t('usuarios.exito.pasoCodigo'), detalle: t('usuarios.exito.vence48'), estado: 'actual' },
                  { id: 'elegir', titulo: t('usuarios.exito.pasoElegir'), estado: 'pendiente' },
                ]}
              />
              <p className="text-body text-subtle">
                {exito.activacion === true
                  ? t('usuarios.exito.conCorreo', { email: exito.email })
                  : exito.activacion === false
                    ? t('usuarios.exito.sinCorreo')
                    : t('usuarios.exito.desconocido', { email: exito.email })}
              </p>
              {exito.activacion !== true && (
                <div className="space-y-2">
                  <Label>{t('usuarios.passwordProvisional')}</Label>
                  <code className="codigo block break-all rounded-(--radius-field) border border-border bg-surface-sunken px-3 py-2 text-body select-all">
                    {exito.password}
                  </code>
                  <Button variant="secondary" size="sm" onClick={() => void copiar()}>
                    <KeyRound />
                    <span key={copiado ? 'si' : 'no'} className="animate-(--animate-swap)">
                      {t(copiado ? 'usuarios.copiado' : 'usuarios.copiar')}
                    </span>
                  </Button>
                </div>
              )}
              <p className="text-meta text-muted">{t('usuarios.exito.codigoVencido')}</p>
            </SidePanelBody>
            <SidePanelFooter>
              <Button
                variant="secondary"
                onClick={() => {
                  reiniciar()
                  requestAnimationFrame(() => nombreRef.current?.focus())
                }}
              >
                {t('usuarios.crearOtro')}
              </Button>
              <Button onClick={() => cambiarAbierto(false)}>{t('usuarios.listo')}</Button>
            </SidePanelFooter>
          </>
        ) : (
          <form id="form-nuevo-usuario" noValidate onSubmit={enviar} className="contents">
            <SidePanelBody className="space-y-4">
              <div>
                <Label htmlFor="u-nombre">{t('usuarios.nombre')}</Label>
                <Input
                  ref={nombreRef}
                  id="u-nombre"
                  required
                  maxLength={120}
                  autoComplete="off"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="u-email">{t('usuarios.email')}</Label>
                <Input
                  ref={emailRef}
                  id="u-email"
                  type="email"
                  required
                  aria-invalid={errorEmail ? true : undefined}
                  aria-describedby={errorEmail ? 'u-email-ayuda u-email-error' : 'u-email-ayuda'}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
                <p id="u-email-ayuda" className="mt-1 text-meta text-muted">{t('usuarios.emailAyuda')}</p>
                {errorEmail && <p id="u-email-error" role="alert" className="mt-1 text-meta text-critical">{errorEmail}</p>}
              </div>
              <div>
                <Label htmlFor="u-rol">{t('usuarios.rol')}</Label>
                <NativeSelect
                  id="u-rol"
                  aria-describedby="u-rol-ayuda"
                  value={form.rol}
                  onChange={(e) => setForm({ ...form, rol: e.target.value as Rol })}
                >
                  {ROLES.map((rol) => (
                    <option key={rol} value={rol}>
                      {t(`roles.${rol}`)}
                    </option>
                  ))}
                </NativeSelect>
                <p id="u-rol-ayuda" className="mt-1 text-meta text-muted">{t(`usuarios.rolAyuda.${form.rol}`)}</p>
              </div>
              <div>
                <Label htmlFor="u-password">{t('usuarios.passwordProvisional')}</Label>
                <div className="flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Input
                      ref={passwordRef}
                      id="u-password"
                      type={visible ? 'text' : 'password'}
                      className="codigo pr-11"
                      required
                      minLength={10}
                      autoComplete="new-password"
                      aria-invalid={errorPassword ? true : undefined}
                      aria-describedby={errorPassword ? 'u-password-ayuda u-password-error' : 'u-password-ayuda'}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                    />
                    <button
                      type="button"
                      aria-pressed={visible}
                      aria-label={visible ? t('login.ocultarPassword') : t('login.mostrarPassword')}
                      onClick={() => setVisible((v) => !v)}
                      className="absolute top-1/2 right-1 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring max-sm:size-11"
                    >
                      {visible ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
                    </button>
                  </div>
                  <Button variant="secondary" onClick={generar}>
                    <KeyRound />
                    {t('usuarios.generarPassword')}
                  </Button>
                </div>
                <p id="u-password-ayuda" className="mt-1 text-meta text-muted">{t('usuarios.passwordProvisionalAyuda')}</p>
                {errorPassword && <p id="u-password-error" role="alert" className="mt-1 text-meta text-critical">{errorPassword}</p>}
                <p role="status" className="sr-only">{anuncio}</p>
              </div>
              <Detalles titulo={t('usuarios.datosOpcionales')} className="border-t border-border pt-2">
                <div className="pb-1">
                  <Label htmlFor="u-telefono">{t('usuarios.telefono')}</Label>
                  <Input
                    id="u-telefono"
                    type="tel"
                    inputMode="tel"
                    autoComplete="off"
                    placeholder="+51999888777"
                    pattern="^\+[1-9][0-9]{7,14}$"
                    title={t('usuarios.telefonoAyuda')}
                    aria-describedby="u-telefono-ayuda"
                    value={form.telefono}
                    onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  />
                  <p id="u-telefono-ayuda" className="mt-1 text-meta text-muted">{t('usuarios.telefonoAyuda')}</p>
                </div>
              </Detalles>
              <MensajeFormulario mensaje={errorGeneral ? { tipo: 'error', texto: errorGeneral } : null} />
            </SidePanelBody>
            <SidePanelFooter>
              <Button variant="ghost" onClick={() => cambiarAbierto(false)} disabled={creando}>
                {t('usuarios.cancelar')}
              </Button>
              <Button type="submit" form="form-nuevo-usuario" disabled={creando}>
                <span key={creando ? 'on' : 'off'} className="animate-(--animate-swap)">
                  {creando ? t('usuarios.creando') : t('usuarios.crear')}
                </span>
              </Button>
            </SidePanelFooter>
          </form>
        )}
      </SidePanelContent>
    </SidePanel>
  )
}
