import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { readFileSync } from "fs";

// Read package.json from the project root
const packageJson = JSON.parse(
  readFileSync(path.resolve(import.meta.dirname, "package.json"), "utf-8")
);

export default defineConfig({
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  base: "./",
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  // Inject the package version
  define: {
    'import.meta.env.APP_VERSION': JSON.stringify(packageJson.version),
    '__APP_VERSION__': JSON.stringify(packageJson.version),
  },
});