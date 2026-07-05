import { normalizeApiBaseUrl, parseWebEnv } from "./web-env.constants";

const env = parseWebEnv({
  API_BASE_URL: import.meta.env.API_BASE_URL,
  WEB_APP_PORT: import.meta.env.WEB_APP_PORT,
});

export const webEnv = {
  apiBaseUrl: normalizeApiBaseUrl(env.API_BASE_URL),
  webAppPort: env.WEB_APP_PORT,
  isDev: import.meta.env.DEV,
} as const;

export type WebEnv = typeof webEnv;
