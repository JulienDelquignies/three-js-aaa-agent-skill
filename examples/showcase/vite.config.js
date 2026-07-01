import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Multi-page app: the gallery home + one HTML entry per scene. base:'./' so it works on any host/path.
export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        volley: resolve(__dirname, 'volley.html'),
        materials: resolve(__dirname, 'materials.html'),
        procedural: resolve(__dirname, 'procedural.html'),
      },
    },
  },
});
