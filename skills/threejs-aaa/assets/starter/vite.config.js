import { defineConfig } from 'vite';

// Modern target for top-level await + ESM. base: './' makes the build portable
// (works from any sub-path on static hosts). Expose on the LAN for device testing.
export default defineConfig({
  base: './',
  build: { target: 'esnext' },
  server: { host: true },
});
