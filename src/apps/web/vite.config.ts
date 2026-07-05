import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import {
  normalizeApiBaseUrl,
  parseWebEnv,
} from "./src/config/web-env.constants";

export default defineConfig(({ mode }) => {
  const appRoot = __dirname;
  const env = parseWebEnv(loadEnv(mode, appRoot, ["API_", "WEB_"]));
  const apiBaseUrl = normalizeApiBaseUrl(env.API_BASE_URL);

  return {
    plugins: [react(), tailwindcss()],
    envDir: appRoot,
    envPrefix: ["API_", "WEB_"],
    resolve: {
      alias: {
        "@": path.resolve(appRoot, "src"),
        "@contract": path.resolve(appRoot, "../../contract"),
        "@contract/*": path.resolve(appRoot, "../../contract/*"),
      },
    },
    server: {
      port: env.WEB_APP_PORT,
      proxy: {
        "/api": {
          target: apiBaseUrl,
          changeOrigin: true,
        },
      },
    },
  };
});
