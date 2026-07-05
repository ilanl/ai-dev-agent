/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly API_BASE_URL: string;
  readonly WEB_APP_PORT: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
