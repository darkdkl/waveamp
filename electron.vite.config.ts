import { resolve } from "node:path";
import { defineConfig } from "electron-vite";

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    build: {
      rollupOptions: {
        input: {
          index: resolve("src/renderer/index.html"),
          settings: resolve("src/renderer/settings.html"),
        },
      },
    },
  },
});
