import { defineConfig, loadEnv, type Connect, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tokenHandler from "./api/token.mjs";

/**
 * Serves the same token-exchange endpoint during local dev that Vercel serves
 * in production (api/token.mjs), so `npm run dev` needs no extra processes.
 */
function anilistTokenDev(env: Record<string, string>): Plugin {
  return {
    name: "anilist-token-dev",
    configureServer(server) {
      // The handler reads process.env; Vite keeps .env files out of it.
      for (const key of ["VITE_ANILIST_CLIENT_ID", "ANILIST_CLIENT_SECRET", "VITE_ANILIST_REDIRECT_URI"]) {
        if (env[key]) process.env[key] = env[key];
      }
      server.middlewares.use("/api/token", ((req, res, next) => {
        if (req.method !== "POST") return next();
        void (tokenHandler as (r: unknown, s: unknown) => unknown)(req, res);
      }) as Connect.NextHandleFunction);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), tailwindcss(), anilistTokenDev(env)],
  };
});
