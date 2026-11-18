import { defineConfig } from "vite";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  plugins: [
    {
      name: "saleng-local-api",
      apply: "serve",
      async configureServer(server) {
        if (!process.env.TURSO_DATABASE_URL) {
          const folder = resolve(".local-data");
          mkdirSync(folder, { recursive: true, mode: 0o700 });
          const file = resolve(folder, "saleng.sqlite");
          process.env.TURSO_DATABASE_URL = "file:" + file;
          if (!existsSync(file))
            execFileSync(process.execPath, [
              "server/init-db.js",
              resolve(folder, "owner-code.txt"),
            ]);
        }
        const { default: handler } = await import("./api/[route].js");
        server.middlewares.use((req, res, next) =>
          req.url?.startsWith("/api/") ? handler(req, res) : next(),
        );
      },
    },
  ],
  server: {
    fs: {
      deny: [
        ".env",
        ".env.*",
        "**/.android-signing/**",
        "**/.local-data/**",
        "**/.vercel/**",
        "**/.git/**",
        "**/*.{p12,jks,pem,crt}",
      ],
    },
  },
});
