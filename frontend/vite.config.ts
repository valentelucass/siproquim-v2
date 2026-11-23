import { defineConfig, type Plugin, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

function api(port: string, dir: string): ProxyOptions {
  return {
    target: "http://127.0.0.1:" + port,
    changeOrigin: true,
    configure(proxy) {
      proxy.on("proxyReq", (outgoing) => {
        const token =
          process.env.SIPROQUIM_TOKEN ||
          readFileSync(resolve(dir, "api.token"), "utf8").trim();
        outgoing.setHeader("X-Siproquim-Token", token);
        outgoing.removeHeader("origin");
      });
    },
  };
}
function localAccess(): Plugin {
  function guard(req: IncomingMessage, res: ServerResponse, next: () => void) {
    const url = req.url || "";
    if (!/^\/api(\/|\?|$)/.test(url)) return next();
    const host = req.headers.host || "";
    const allowed = /^(127\.0\.0\.1|localhost):\d+$/.test(host);
    if (
      !allowed ||
      req.headers["x-siproquim-ui"] !== "local" ||
      (req.headers.origin && req.headers.origin !== "http://" + host) ||
      req.headers["sec-fetch-site"] === "cross-site"
    ) {
      res.statusCode = 403;
      res.end();
      return;
    }
    try {
      if (!process.env.SIPROQUIM_TOKEN)
        readFileSync(resolve(dataDir, "api.token"));
    } catch {
      res.statusCode = 503;
      res.end("Serviço local ainda indisponível.");
      return;
    }
    next();
  }
  return {
    name: "acesso-local",
    configureServer(server) {
      server.middlewares.use(guard);
    },
    configurePreviewServer(server) {
      server.middlewares.use(guard);
    },
  };
}
const dataDir = resolve(process.env.SIPROQUIM_DADOS || "../database");
const network = {
  host: "127.0.0.1",
  port: 5173,
  strictPort: true,
  cors: false as const,
  proxy: {
    "/api": api(process.env.SIPROQUIM_PORTA || "8765", dataDir),
  },
};
export default defineConfig({
  plugins: [react(), localAccess()],
  server: { ...network, fs: { allow: [process.cwd()] } },
  preview: network,
});
