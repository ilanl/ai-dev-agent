import { z } from "zod";

export const webEnvSchema = z.object({
  API_BASE_URL: z.string().min(1, "API_BASE_URL is required"),
  WEB_APP_PORT: z.coerce
    .number()
    .int()
    .positive("WEB_APP_PORT must be a positive integer"),
});

export type ParsedWebEnv = z.infer<typeof webEnvSchema>;

export const parseWebEnv = (
  raw: Record<string, string | undefined>,
): ParsedWebEnv =>
  webEnvSchema.parse({
    API_BASE_URL: raw.API_BASE_URL,
    WEB_APP_PORT: raw.WEB_APP_PORT,
  });

export const normalizeApiBaseUrl = (url: string): string =>
  url.trim().replace(/\/$/, "");
