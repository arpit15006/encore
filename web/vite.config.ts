import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // In development the API runs separately (npm run dev); Vite forwards /api to it.
  server: { proxy: { "/api": "http://localhost:8080" } },
});
