import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  FileText,
  Loader2,
  Mail,
  User,
  ShieldCheck,
} from 'lucide-react'

import type { Rol } from '@/domain/value-objects/Rol'
import { AuthShell } from '../components/auth/AuthShell'
import { ColdCareBrandPanel } from '../components/auth/ColdCareBrandPanel'
import { Input, Label, NativeSelect, Textarea } from '../components/ui/input'

const OPCIONES_ROLES: Array<{ rol: Rol; claveI18n: string }> = [
  { rol: 'farmaceutico', claveI18n: 'rolFarmaceutico' },
  { rol: 'tecnico', claveI18n: 'rolTecnico' },
  { rol: 'auditor', claveI18n: 'rolAuditor' },
  { rol: 'administrador', claveI18n: 'rolAdmin' },
]

export function SolicitarAccesoPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState(() => searchParams.get('email') ?? '')
  const [rolSolicitado, setRolSolicitado] = useState<Rol>('farmaceutico')
  const [establecimiento, setEstablecimiento] = useState('')
  const [motivo, setMotivo] = useState('')
  const [cargando, setCargando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const manejarEnvio = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!nombre.trim() || !email.trim() || !establecimiento.trim() || !motivo.trim()) {
      setError(t('solicitarAcceso.errorCampos'))
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(t('solicitarAcceso.errorEmail'))
      return
    }

    setCargando(true)
    try {
      // Simulación de envío a la cola de solicitudes del administrador del establecimiento
      await new Promise((resolve) => setTimeout(resolve, 500))
      setEnviado(true)
    } finally {
      setCargando(false)
    }
  }

  return (
    <AuthShell brandPanel={<ColdCareBrandPanel />}>
      <div className="flex flex-col">
        <div>
          {/* Cabecera */}
          <div className="mb-6">
            <Link
              to="/login"
              className="mb-5 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              <span>{t('solicitarAcceso.volverLogin')}</span>
            </Link>
            <h2 className="text-[28px] leading-[34px] font-bold tracking-tight text-foreground sm:text-[32px] sm:leading-10">
              {t('solicitarAcceso.titulo')}
            </h2>
            <p className="mt-2 text-base leading-6 text-muted">
              {t('solicitarAcceso.subtitulo')}
            </p>
          </div>

          {enviado ? (
            /* Estado de confirmación de solicitud enviada */
            <div className="space-y-6 animate-fade">
              <div className="rounded-2xl border border-border bg-secondary-tint/60 p-5">
                <div className="flex items-start gap-3.5">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary-tint text-glacier-700">
                    <CheckCircle2 className="size-5" aria-hidden />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-base font-bold text-foreground">
                      {t('solicitarAcceso.exitoTitulo')}
                    </h3>
                    <p className="text-sm text-muted leading-relaxed">
                      {t('solicitarAcceso.exitoMensaje')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-cream-100/50 p-4 text-xs text-muted space-y-1">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <ShieldCheck className="size-4 text-primary" aria-hidden />
                  <span>Resumen de solicitud</span>
                </div>
                <p><strong>Solicitante:</strong> {nombre} ({email})</p>
                <p><strong>Establecimiento:</strong> {establecimiento}</p>
                <p><strong>Rol:</strong> {t(`roles.${rolSolicitado}`, { defaultValue: rolSolicitado })}</p>
              </div>

              <Link
                to="/login"
                className="flex h-11 w-full items-center justify-center rounded-xl coldcare-primary-action px-4 text-sm font-semibold text-white shadow-(--shadow-card) hover:shadow-(--shadow-card) transition-all"
              >
                {t('solicitarAcceso.volverLogin')}
              </Link>
            </div>
          ) : (
            /* Formulario de solicitud de acceso RBAC */
            <form onSubmit={manejarEnvio} className="space-y-3.5" noValidate>
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="solicitud-nombre">{t('solicitarAcceso.nombre')}</Label>
                  <div className="relative">
                    <Input
                      id="solicitud-nombre"
                      type="text"
                      autoComplete="name"
                      placeholder={t('solicitarAcceso.nombrePlaceholder', {
                        defaultValue: 'Dra. Carmen Mendoza',
                      })}
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      required
                    />
                    <User className="absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-muted pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="solicitud-email">{t('solicitarAcceso.email')}</Label>
                  <div className="relative">
                    <Input
                      id="solicitud-email"
                      type="email"
                      autoComplete="email"
                      placeholder={t('solicitarAcceso.emailPlaceholder', {
                        defaultValue: 'carmen@farmacia.pe',
                      })}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                    <Mail className="absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-muted pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="solicitud-establecimiento">
                    {t('solicitarAcceso.establecimiento')}
                  </Label>
                  <div className="relative">
                    <Input
                      id="solicitud-establecimiento"
                      type="text"
                      placeholder={t('solicitarAcceso.establecimientoPlaceholder', {
                        defaultValue: 'Botica Central / Sede Norte',
                      })}
                      value={establecimiento}
                      onChange={(e) => setEstablecimiento(e.target.value)}
                      required
                    />
                    <Building2 className="absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-muted pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="solicitud-rol">{t('solicitarAcceso.rolSolicitado')}</Label>
                  <NativeSelect
                    id="solicitud-rol"
                    value={rolSolicitado}
                    onChange={(e) => setRolSolicitado(e.target.value as Rol)}
                    className="cursor-pointer"
                  >
                    {OPCIONES_ROLES.map(({ rol, claveI18n }) => (
                      <option key={rol} value={rol}>
                        {t(`solicitarAcceso.${claveI18n}`, {
                          defaultValue: t(`roles.${rol}`, { defaultValue: rol }),
                        })}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="solicitud-motivo">{t('solicitarAcceso.motivo')}</Label>
                <div className="relative">
                  <Textarea
                    id="solicitud-motivo"
                    rows={2}
                    placeholder={t('solicitarAcceso.motivoPlaceholder', {
                      defaultValue: 'Indica tu área y motivo de solicitud...',
                    })}
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    className="resize-none pr-10"
                    required
                  />
                  <FileText className="absolute right-3.5 top-3.5 size-4 text-muted pointer-events-none" />
                </div>
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-xl border border-clay-100 bg-clay-100/60 px-3.5 py-2.5 text-sm text-clay-700 animate-fade"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={cargando}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl coldcare-primary-action px-4 text-sm font-semibold text-white shadow-(--shadow-card) transition-all duration-200 hover:shadow-(--shadow-card) active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60 cursor-pointer"
              >
                {cargando ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    <span>{t('solicitarAcceso.enviando')}</span>
                  </>
                ) : (
                  <span>{t('solicitarAcceso.enviar')}</span>
                )}
              </button>
            </form>
          )}
        </div>

        <div className="pt-4 text-center text-xs text-muted">
          <Link
            to="/login"
            className="font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary rounded-sm"
          >
            ← {t('solicitarAcceso.volverLogin')}
          </Link>
        </div>
      </div>
    </AuthShell>
  )
}
