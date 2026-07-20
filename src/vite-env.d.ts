/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly HEALTH_API?: string
  readonly VITE_HEALTH_API?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
