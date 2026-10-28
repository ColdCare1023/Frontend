/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MODO_DEMO?: string
  readonly VITE_API_BASE_URL?: string
  /** Flujo SSE en otro origen; por defecto `<API>/api/sse/lecturas`. */
  readonly VITE_SSE_URL?: string
  /** FE-001: client ID de Google Identity Services; sin él no se ofrece Google. */
  readonly VITE_GOOGLE_CLIENT_ID?: string
}
