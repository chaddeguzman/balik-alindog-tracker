/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HEALTH_API?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
