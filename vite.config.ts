import path from "node:path";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    // Porta 3100: o painel usa a 5173 e o app mobile a 3000. Em desenvolvimento, a API passa pelo proxy abaixo. O
    // `changeOrigin` só troca o Host: o navegador continua mandando `Origin: http://localhost:3100`, que o Django recusa
    // (403 "Origin not allowed", `StrictOriginMiddleware`). Por isso o proxy tira o `Origin`: vira uma chamada de
    // servidor para servidor, sem mexer na lista de origens do backend. Só vale no `npm run dev`.
    server: {
      host: true,
      port: 3100,
      strictPort: true,
      proxy: {
        "/api": {
          target: env.DEV_BACKEND_URL || "http://localhost:8000",
          changeOrigin: true,
          rewrite: (url) => url.replace(/^\/api/, ""),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => proxyReq.removeHeader("origin"));
          },
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
