import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    open: true,
    proxy: {
      "/aggregator-machines": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/vettasoft": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      // VettaSoft AJAX usa path assoluti (/api, /widgets); fallback se JS in cache e' vecchio
      "/api": {
        target: "http://localhost:8000/vettasoft",
        changeOrigin: true,
      },
      "/widgets": {
        target: "http://localhost:8000/vettasoft",
        changeOrigin: true,
      },
    },
  },
});
