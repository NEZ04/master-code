import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// In development, /api is proxied to the API server; in Docker, nginx does the same.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:4000" } },
});
