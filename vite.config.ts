import path from "path"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5174,
    host: "0.0.0.0",
    allowedHosts: ["wellous.nuradigital.test", "wellous-dev.nuradigital.test", "claris.nuradigital.test"],
  },
})
