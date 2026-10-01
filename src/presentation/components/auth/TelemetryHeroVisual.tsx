import { useId } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { CheckCircle2, ShieldCheck, Thermometer, Wifi } from 'lucide-react'
import {
  floatingCard1Variants,
  floatingCard2Variants,
  getAccessibleVariants,
} from './loginMotion'

/**
 * Visualización central de monitoreo térmico ColdCare (Showcase Card).
 * Basada fielmente en la identidad y paleta oficial ColdCare (#0B5CFF, #00D1FF, #FF7AA2, #0F172A, #F4F7FB):
 * - El Arco Térmico oficial con gradiente cian -> azul -> rosa.
 * - Tarjeta blanca clínica limpia con lectura clara de 4.8 °C en rango seguro (2 °C – 8 °C).
 * - Altura calibrada para encajar perfectamente sin corte en laptops de 768px y 800px.
 */
export function TelemetryHeroVisual() {
  const shouldReduceMotion = useReducedMotion()
  const rawId = useId().replace(/:/g, '')
  const gradientId = `arc-grad-${rawId}`
  const trackGradientId = `track-grad-${rawId}`
  const sparklineGradId = `spark-grad-${rawId}`

  return (
    <div className="relative mx-auto w-full max-w-[380px] xl:max-w-[400px] select-none py-1">
      {/* Halos de luz ambiental suave basados en la paleta de marca */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-8 -left-8 size-60 rounded-full bg-[#00D1FF]/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-8 -right-8 size-60 rounded-full bg-[#0B5CFF]/08 blur-3xl"
      />

      {/* 1. Tarjeta Principal de Monitoreo Térmico */}
      <div className="relative z-10 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 p-4 sm:p-5 shadow-[0_16px_36px_rgba(11,92,255,0.07),0_4px_12px_rgba(15,23,42,0.03)] backdrop-blur-md">
        {/* Cabecera de la tarjeta: Estado operativo y norma */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200/60">
            <span className="relative flex size-2">
              {!shouldReduceMotion && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              )}
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            <span>Sistema en Rango Óptimo</span>
          </div>

          <span className="text-[10px] font-medium tracking-wide text-slate-400 uppercase">
            Norma DIGEMID
          </span>
        </div>

        {/* Zona Central: El Arco Térmico ColdCare con lectura de temperatura */}
        <div className="relative my-2 flex flex-col items-center justify-center">
          {/* Gráfico circular del Arco Térmico SVG */}
          <div className="relative size-40 sm:size-44">
            <svg
              className="h-full w-full overflow-visible"
              viewBox="0 0 220 180"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-label="Indicador térmico de 4.8 grados centígrados dentro del rango de 2 a 8 grados"
            >
              <defs>
                {/* Gradiente oficial del Arco Térmico ColdCare */}
                <linearGradient id={gradientId} x1="40" y1="160" x2="180" y2="160" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#00D1FF" />
                  <stop offset="50%" stopColor="#0B5CFF" />
                  <stop offset="100%" stopColor="#FF7AA2" />
                </linearGradient>

                <linearGradient id={trackGradientId} x1="40" y1="160" x2="180" y2="160" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#E2E8F0" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#E2E8F0" stopOpacity="0.6" />
                </linearGradient>

                {/* Sombra suave para el marcador */}
                <filter id="marker-shadow" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#0B5CFF" floodOpacity="0.35" />
                </filter>
              </defs>

              {/* Arco base de fondo (pista inactiva) */}
              <path
                d="M 44.5 155.9 A 80 80 0 1 1 175.5 155.9"
                stroke={`url(#${trackGradientId})`}
                strokeWidth="10"
                strokeLinecap="round"
              />

              {/* Arco Térmico activo (Gradiente ColdCare: Cian -> Azul -> Rosa) */}
              <motion.path
                d="M 44.5 155.9 A 80 80 0 1 1 175.5 155.9"
                stroke={`url(#${gradientId})`}
                strokeWidth="10"
                strokeLinecap="round"
                initial={shouldReduceMotion ? { pathLength: 1 } : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
              />

              {/* Marcador de lectura actual (4.8 °C situado en la parte superior segura) */}
              <g transform="translate(100, 31)" filter="url(#marker-shadow)">
                <circle r="7" fill="white" stroke="#0B5CFF" strokeWidth="2.5" />
                <circle r="2.5" fill="#0B5CFF" />
              </g>

              {/* Etiquetas sutiles en los extremos del arco */}
              <text x="36" y="174" fill="#64748B" fontSize="11" fontWeight="600" textAnchor="middle">
                2 °C
              </text>
              <text x="184" y="174" fill="#64748B" fontSize="11" fontWeight="600" textAnchor="middle">
                8 °C
              </text>
            </svg>

            {/* Contenido dentro del arco térmico */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pt-4">
              <div className="mb-0.5 flex size-7 items-center justify-center rounded-full bg-blue-50 text-[#0B5CFF] border border-blue-100">
                <Thermometer className="size-4" aria-hidden />
              </div>
              <div className="flex items-baseline gap-0.5">
                <span className="font-sans text-3xl sm:text-4xl font-extrabold tracking-tight text-[#0F172A] tabular-nums">
                  4.8
                </span>
                <span className="text-lg sm:text-xl font-bold text-slate-400">°C</span>
              </div>
              <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                <CheckCircle2 className="size-2.5 text-emerald-600" aria-hidden />
                Temperatura Estable
              </span>
            </div>
          </div>

          <p className="mt-1 text-[11px] font-medium text-slate-500">
            Rango de conservación: <strong className="text-slate-700">2.0 °C – 8.0 °C</strong>
          </p>
        </div>

        {/* Zona Inferior: Curva de estabilidad de 24 horas y métricas claras */}
        <div className="mt-2 rounded-xl bg-slate-50/80 p-2.5 border border-slate-100">
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span className="font-medium text-slate-600">Estabilidad últimas 24 h</span>
            <span className="font-semibold text-emerald-600">100% en rango</span>
          </div>

          {/* Micro-sparkline continuo y sereno */}
          <div className="h-7 w-full">
            <svg className="h-full w-full overflow-hidden" viewBox="0 0 300 30" fill="none" preserveAspectRatio="none">
              <defs>
                <linearGradient id={sparklineGradId} x1="0" y1="0" x2="0" y2="30" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#0B5CFF" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#0B5CFF" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M 0 15 Q 30 11, 60 15 T 120 14 T 180 16 T 240 13 T 300 15 L 300 30 L 0 30 Z"
                fill={`url(#${sparklineGradId})`}
              />
              <path
                d="M 0 15 Q 30 11, 60 15 T 120 14 T 180 16 T 240 13 T 300 15"
                stroke="#0B5CFF"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <div className="mt-1.5 flex items-center justify-between border-t border-slate-200/60 pt-1.5 text-[10px] text-slate-500">
            <span>Cámara principal activa</span>
            <span className="font-medium text-slate-700">Lote de vacunas protegido</span>
          </div>
        </div>
      </div>

      {/* 2. Micro-chips flotantes sutiles */}

      {/* Micro-chip 1: Sensores en línea (Arriba a la derecha) */}
      <motion.div
        variants={getAccessibleVariants(floatingCard1Variants, shouldReduceMotion)}
        animate="animate"
        className="hidden sm:flex absolute -top-2.5 -right-2 items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/95 px-3 py-1 shadow-sm backdrop-blur-md z-20 text-[11px]"
      >
        <Wifi className="size-3 text-[#00D1FF]" aria-hidden />
        <span className="font-semibold text-slate-700">Sensores activos</span>
        <span className="text-[10px] text-slate-400">· 2 s</span>
      </motion.div>

      {/* Micro-chip 2: Garantía de conservación (Abajo a la izquierda) */}
      <motion.div
        variants={getAccessibleVariants(floatingCard2Variants, shouldReduceMotion)}
        animate="animate"
        className="hidden sm:flex absolute -bottom-2 -left-2 items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/95 px-3 py-1 shadow-sm backdrop-blur-md z-20 text-[11px]"
      >
        <ShieldCheck className="size-3 text-[#0B5CFF]" aria-hidden />
        <span className="font-semibold text-slate-700">Cadena de frío continua</span>
      </motion.div>
    </div>
  )
}
