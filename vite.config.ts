import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: "web",
  build: {
    outDir: "../web/dist",
    emptyOutDir: true,
  },
  server: {
    port: 4242,
    proxy: {
      "/api": "http://localhost:7070",
    },
  },
});