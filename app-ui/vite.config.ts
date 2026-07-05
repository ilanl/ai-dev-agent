import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:9478",
      "/ws": { target: "ws://127.0.0.1:9478", ws: true },
    },
  },
  build: {
    outDir: join(root, "dist"),
    emptyOutDir: true,
  },
});
