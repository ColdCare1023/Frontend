import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import {
  Activity,
  Bell,
  Brain,
  ClipboardCheck,
  DownloadCloud,
  FileText,
  HardDrive,
  History,
  Link2,
  ScrollText,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react'

import { useAuthStore } from '@/application/stores/authStore'
import { tienePermiso, type Rol } from '@/domain/value-objects/Rol'
import { PageHeader } from '../components/PageHeader'
import { REOPEN_TOUR_EVENT } from '../components/OnboardingTour'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'

/**
 * Guía de uso dentro de la propia aplicación.
 *
 * El sistema tiene once pantallas y un vocabulario que no es el de una
 * farmacia: "trazabilidad", "hash encadenado", "F1 ponderado". Quien lo va a
 * usar a diario es personal técnico y químicos farmacéuticos, no ingenieros.
 * Esta página traduce cada sección a lo que significa en su trabajo y a qué se
 * espera que hagan con ella.
 *
 * Se muestran solo las secciones que el rol de quien mira puede abrir: una
 * guía que explica pantallas inaccesibles genera más dudas de las que resuelve.
 */

interface Seccion {
  ruta: string
  icono: LucideIcon
  titulo: string
  queEs: string
  cuandoUsarla: string
  roles: Rol[]
}

const SECCIONES: Seccion[] = [
  {
    ruta: '/dashboard',
    icono: Activity,
    titulo: 'Monitoreo',
    queEs:
      'La foto del refrigerador en este momento: temperatura junto al medicamento, temperatura del ambiente, humedad y si la puerta quedó abierta. Se actualiza sola, sin recargar.',
    cuandoUsarla:
      'Es la pantalla para dejar abierta durante la jornada. Si el semáforo pasa a naranja o rojo, algo requiere tu atención ahora.',
    roles: ['farmaceutico', 'tecnico'],
  },
  {
    ruta: '/historial',
    icono: History,
    titulo: 'Historial',
    queEs:
      'Todas las mediciones registradas, con filtros por dispositivo, nivel de riesgo y rango de fechas.',
    cuandoUsarla:
      'Cuando necesitas reconstruir qué pasó: "el martes por la tarde, ¿cuánto tiempo estuvo fuera de rango?".',
    roles: ['farmaceutico', 'tecnico'],
  },
  {
    ruta: '/alertas',
    icono: Bell,
    titulo: 'Alertas',
    queEs:
      'Los avisos que generó el sistema, separados en dos niveles. Riesgo preventivo significa que se está acercando al límite; excursión crítica, que ya salió del rango 2–8 °C.',
    cuandoUsarla:
      'Revísalas a diario. Al marcar una como revisada puedes escribir qué hiciste al respecto — esa nota queda como evidencia de que se actuó.',
    roles: ['farmaceutico', 'tecnico'],
  },
  {
    ruta: '/trazabilidad',
    icono: Link2,
    titulo: 'Trazabilidad',
    queEs:
      'El registro sellado de todo lo ocurrido. Cada anotación guarda una huella digital de la anterior, de modo que forman una cadena.',
    cuandoUsarla:
      'El botón «Verificar registros» recalcula esa cadena entera. Si alguien modificó un dato después de guardarlo, aquí se detecta y se señala cuál. Es la prueba de que la evidencia no fue retocada.',
    roles: ['farmaceutico', 'tecnico'],
  },
  {
    ruta: '/checklist-bpa',
    icono: ClipboardCheck,
    titulo: 'Checklist BPA',
    queEs:
      'Los diez puntos de verificación diaria del Manual de Buenas Prácticas de Almacenamiento, en formato digital.',
    cuandoUsarla:
      'Una vez al día. Al guardarlo queda firmado con tu usuario y entra en la cadena de trazabilidad, así que sustituye a la planilla de papel.',
    roles: ['farmaceutico'],
  },
  {
    ruta: '/reportes',
    icono: FileText,
    titulo: 'Reportes BPA',
    queEs:
      'El expediente de un periodo: mediciones, alertas, acciones tomadas y el veredicto de integridad de la cadena. Se descarga en PDF, CSV o JSON.',
    cuandoUsarla:
      'Ante una inspección o auditoría. El PDF es el documento para entregar; el CSV sirve si te piden los datos para analizarlos aparte.',
    roles: ['farmaceutico'],
  },
  {
    ruta: '/metricas-ia',
    icono: Brain,
    titulo: 'Métricas del modelo',
    queEs:
      'El desempeño del clasificador que decide el nivel de riesgo de cada lectura, con su tasa de acierto por tipo de situación.',
    cuandoUsarla:
      'Cuando necesites sustentar por qué se puede confiar en la clasificación automática. La cifra clave es el F1 ponderado, que debe mantenerse por encima de 0.85.',
    roles: ['farmaceutico'],
  },
  {
    ruta: '/auditoria',
    icono: ScrollText,
    titulo: 'Bitácora de auditoría',
    queEs:
      'Quién hizo qué y desde dónde: accesos, revisiones de alertas, exportaciones de reportes, altas de usuario.',
    cuandoUsarla:
      'Para responder «¿quién hizo este cambio?». Las entradas no se pueden editar ni borrar.',
    roles: [],
  },
  {
    ruta: '/usuarios',
    icono: Users,
    titulo: 'Usuarios y roles',
    queEs:
      'Quién entra al sistema y qué puede hacer. El técnico consulta; el químico farmacéutico además firma checklists y emite reportes; el administrador gestiona el sistema.',
    cuandoUsarla:
      'Al incorporar o dar de baja personal. Desactivar no borra a la persona: su rastro en la bitácora debe seguir siendo atribuible.',
    roles: [],
  },
  {
    ruta: '/dispositivos',
    icono: HardDrive,
    titulo: 'Dispositivos',
    queEs:
      'Los equipos de medición instalados, su estado de conexión y sus fechas de calibración.',
    cuandoUsarla:
      'Para comprobar que un nodo sigue reportando y que su calibración está vigente. Un sensor descalibrado invalida las mediciones que produjo.',
    roles: [],
  },
  {
    ruta: '/firmware',
    icono: DownloadCloud,
    titulo: 'Firmware',
    queEs: 'Las versiones del programa que corre dentro de los equipos de medición.',
    cuandoUsarla: 'Al actualizar un equipo. Cada versión queda registrada con su huella digital.',
    roles: [],
  },
]

const CONCEPTOS = [
  {
    termino: 'Rango 2–8 °C',
    explicacion:
      'La franja en la que los medicamentos termolábiles se conservan sin perder eficacia. Todo el sistema gira alrededor de mantener el refrigerador dentro de ella.',
  },
  {
    termino: 'Riesgo preventivo',
    explicacion:
      'La temperatura aún está dentro del rango, pero se acerca al límite o viene subiendo. Es un aviso para revisar antes de que haya un problema.',
  },
  {
    termino: 'Excursión crítica',
    explicacion:
      'La temperatura salió del rango. El producto puede haberse comprometido: hay que actuar y dejar constancia de qué se hizo.',
  },
  {
    termino: 'Cadena de trazabilidad',
    explicacion:
      'Cada registro guarda una huella digital del anterior. Modificar un dato viejo rompe la cadena de ahí en adelante, y el sistema lo detecta. Por eso el histórico sirve como prueba.',
  },
  {
    termino: 'BPA',
    explicacion:
      'Buenas Prácticas de Almacenamiento: la norma que exige verificar y documentar a diario las condiciones de conservación.',
  },
]

const SECCIONES_EN: Record<string, Pick<Seccion, 'titulo' | 'queEs' | 'cuandoUsarla'>> = {
  '/dashboard': {
    titulo: 'Monitoring',
    queEs: 'A live view of the refrigerator: temperature next to the medicine, room temperature, humidity, and whether the door was left open. It updates without reloading.',
    cuandoUsarla: 'Keep this screen open during your shift. An amber or red status needs your attention.',
  },
  '/historial': {
    titulo: 'History',
    queEs: 'Recorded readings with filters for device, risk level, and date range.',
    cuandoUsarla: 'Use it to reconstruct what happened, for example how long the temperature stayed outside its range on a given afternoon.',
  },
  '/alertas': {
    titulo: 'Alerts',
    queEs: 'System notices in two levels. Preventive risk means the temperature is approaching a limit; critical excursion means it has left the 2–8 °C range.',
    cuandoUsarla: 'Review alerts daily. When acknowledging one, record what you did; that note becomes evidence of the response.',
  },
  '/trazabilidad': {
    titulo: 'Traceability',
    queEs: 'A sealed log of events. Each entry stores a digital fingerprint of the previous one, forming a chain.',
    cuandoUsarla: 'Verify records to recalculate the chain. If a saved entry changed, the system identifies it so the evidence can be checked.',
  },
  '/checklist-bpa': {
    titulo: 'GSP checklist',
    queEs: 'Ten daily checks from the Good Storage Practices Manual, in digital form.',
    cuandoUsarla: 'Complete it once a day. Saving records your account and adds the checklist to the traceability chain.',
  },
  '/reportes': {
    titulo: 'GSP reports',
    queEs: 'A period record with readings, alerts, actions, and a traceability integrity result. Download it as PDF, CSV, or JSON.',
    cuandoUsarla: 'Use it for an inspection or audit. PDF is ready to share; CSV supports further analysis.',
  },
  '/metricas-ia': {
    titulo: 'Model metrics',
    queEs: 'Performance of the classifier that assigns a risk level to each reading, including accuracy by situation.',
    cuandoUsarla: 'Use these metrics to support decisions about automatic classification. The weighted F1 score should remain above 0.85.',
  },
  '/auditoria': {
    titulo: 'Audit log',
    queEs: 'Who did what and when: sign-ins, alert reviews, report exports, and user creation.',
    cuandoUsarla: 'Use it to answer who made a change. Entries cannot be edited or deleted.',
  },
  '/usuarios': {
    titulo: 'Users and roles',
    queEs: 'Who can enter the system and what they can do. Pharmacy staff review data; pharmacists also sign checklists and issue reports; administrators manage the system.',
    cuandoUsarla: 'Use it when staff join or leave. Deactivation preserves the person’s audit history.',
  },
  '/dispositivos': {
    titulo: 'Devices',
    queEs: 'Installed measurement devices, their connection status, and calibration dates.',
    cuandoUsarla: 'Check that each node reports and its calibration is current. An uncalibrated sensor makes its readings unreliable.',
  },
  '/firmware': {
    titulo: 'Firmware',
    queEs: 'Software versions that run on the measurement devices.',
    cuandoUsarla: 'When updating a device, each version is recorded with its digital fingerprint.',
  },
}

const CONCEPTOS_EN = [
  { termino: '2–8 °C range', explicacion: 'The range that keeps temperature-sensitive medicines effective. The system helps keep the refrigerator within it.' },
  { termino: 'Preventive risk', explicacion: 'Temperature remains within range but is approaching a limit or trending upward. Review the refrigerator before an excursion occurs.' },
  { termino: 'Critical excursion', explicacion: 'Temperature has left the accepted range. Product quality may be affected; respond and record what was done.' },
  { termino: 'Traceability chain', explicacion: 'Each entry stores a digital fingerprint of the one before it. Changing an old entry breaks the chain and the system detects it.' },
  { termino: 'GSP', explicacion: 'Good Storage Practices: the standard requiring daily checks and records of storage conditions.' },
]

const RUTINA_EN = [
  'Open Monitoring at the start of your shift and keep it visible.',
  'If an alert appears, review it and record what you did.',
  'Before leaving, complete that day’s GSP checklist.',
  'When evidence is requested, generate a report for the relevant period.',
]

export function GuiaPage() {
  const { t, i18n } = useTranslation()
  const en = i18n.resolvedLanguage === 'en'
  const usuario = useAuthStore((s) => s.usuario)
  const rol = usuario?.rol

  const visibles = SECCIONES.filter((s) => (rol ? tienePermiso(rol, s.roles) : false))

  return (
    <div>
      <PageHeader
        eyebrow={t('guia.eyebrow')}
        titulo={t('guia.titulo')}
        descripcion={t('guia.descripcion')}
      />

      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event(REOPEN_TOUR_EVENT))}
        className="mb-6 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground shadow-(--shadow-card) transition-colors hover:bg-cream-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {t('guia.volverAVerRecorrido', { defaultValue: 'Volver a ver recorrido' })}
      </button>

      {/* ── Recorrido de un día ─────────────────────────────── */}
      <Card className="animate-rise">
        <CardHeader>
          <CardTitle>{t('guia.rutinaTitulo')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-3">
            {(en ? RUTINA_EN : [
              'Abre Monitoreo al empezar la jornada y déjalo visible.',
              'Si aparece una alerta, entra en Alertas, revísala y anota qué hiciste.',
              'Antes de cerrar, completa el Checklist BPA del día.',
              'Cuando te pidan evidencia, genera el reporte del periodo en Reportes.',
            ]).map((paso, i) => (
              <li key={paso} className="flex gap-3 text-[15px] text-muted">
                <span className="nums flex size-6 shrink-0 items-center justify-center rounded-full bg-cream-200 text-xs font-semibold text-ink-700">
                  {i + 1}
                </span>
                {paso}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* ── Qué hace cada pantalla ──────────────────────────── */}
      <h2 className="mt-8 font-display text-2xl leading-8 font-semibold tracking-tight">
        {t('guia.seccionesTitulo')}
      </h2>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {visibles.map((seccion, i) => (
          <Card
            key={seccion.ruta}
            className="card-lift animate-rise"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <CardContent className="pt-5">
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-cream-200 text-ink-700">
                  <seccion.icono className="size-[18px]" />
                </span>
                <div className="min-w-0">
                  <Link
                    to={seccion.ruta}
                    className="font-display text-[17px] font-semibold tracking-tight hover:underline"
                  >
                    {en ? SECCIONES_EN[seccion.ruta]?.titulo ?? seccion.titulo : seccion.titulo}
                  </Link>
                  <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">{en ? SECCIONES_EN[seccion.ruta]?.queEs ?? seccion.queEs : seccion.queEs}</p>
                  <p className="mt-2.5 border-l-2 border-border pl-3 text-[13.5px] leading-relaxed text-ink-500">
                    {en ? SECCIONES_EN[seccion.ruta]?.cuandoUsarla ?? seccion.cuandoUsarla : seccion.cuandoUsarla}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Vocabulario ─────────────────────────────────────── */}
      <h2 className="mt-8 font-display text-2xl leading-8 font-semibold tracking-tight">
        {t('guia.conceptosTitulo')}
      </h2>
      <Card className="mt-4 animate-rise">
        <CardContent className="pt-5">
          <dl className="grid gap-4">
            {(en ? CONCEPTOS_EN : CONCEPTOS).map((c) => (
              <div key={c.termino} className="border-b border-border pb-4 last:border-0 last:pb-0">
                <dt className="font-display text-[15.5px] font-semibold">{c.termino}</dt>
                <dd className="mt-1 text-[14.5px] leading-relaxed text-muted">{c.explicacion}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <p className="mt-6 flex items-start gap-2 text-[13px] text-ink-500">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-pine-600" />
        {t('guia.nota')}
      </p>
    </div>
  )
}
