import path from "node:path";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    // Porta 3100: o painel usa a 5173 e o app mobile a 3000. Em desenvolvimento, a API passa pelo proxy abaixo, então o
    // Django local não precisa aceitar esta origem no CORS.
    server: {
      host: true,
      port: 3100,
      strictPort: true,
      proxy: {
        "/api": {
          target: env.DEV_BACKEND_URL || "http://localhost:8000",
          changeOrigin: true,
          rewrite: (url) => url.replace(/^\/api/, ""),
        },
      },
    },
    preview: { host: true, port: 4173, strictPort: true },
    resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
    build: { sourcemap: false },
    plugins: [react()],
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: "./src/test/setup.ts",
      include: ["src/**/*.test.{ts,tsx}"],
      css: false,
    },
  };
});
