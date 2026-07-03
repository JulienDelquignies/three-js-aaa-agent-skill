import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Multi-page app: the gallery home + one HTML entry per scene. base:'./' so it works on any host/path.
const page = (name) => resolve(__dirname, `${name}.html`);
export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: page('index'),
        controls: page('controls'),
        physics: page('physics'),
        places: page('places'),
        interieur: page('interieur'),
        carriere: page('carriere'),
        stadiums: page('stadiums'),
        volley: page('volley'),
        materials: page('materials'),
        procedural: page('procedural'),
        interaction: page('interaction'),
        geometry: page('geometry'),
        neon: page('neon'),
        ocean: page('ocean'),
        grass: page('grass'),
      },
    },
  },
});
