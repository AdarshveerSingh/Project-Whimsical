
import { defineConfig } from "vite";

export default defineConfig({
  root: "game",
  server: {
    host: "127.0.0.1"
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true
  }
});
