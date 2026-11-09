/*
 * Adaptado de sileo (https://github.com/hiaaryan/sileo, commit b70fd82),
 * MIT © Aaryan. Cambios para ColdCare: estilo «notch» siempre oscuro, iconos
 * de lucide, sin región aria-live propia (los avisos accesibles los publica
 * AvisosTiempoReal), expansión con foco de teclado y cierre con Escape.
 */
import type { ReactNode } from "react";

export type SileoState = "success" | "loading" | "error" | "warning" | "info" | "action";

export interface SileoStyles {
  title?: string;
  description?: string;
  badge?: string;
  button?: string;
}

export interface SileoButton {
  title: string;
  onClick: () => void;
}

export const SILEO_POSITIONS = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
] as const;

export type SileoPosition = (typeof SILEO_POSITIONS)[number];

export interface SileoOptions {
  title?: string;
  description?: ReactNode | string;
  type?: SileoState;
  position?: SileoPosition;
  duration?: number | null;
  icon?: ReactNode | null;
  styles?: SileoStyles;
  fill?: string;
  roundness?: number;
  autopilot?: boolean | { expand?: number; collapse?: number };
  button?: SileoButton;
  /** Nombre accesible del aviso (título y detalle en texto plano). */
  etiqueta?: string;
}
