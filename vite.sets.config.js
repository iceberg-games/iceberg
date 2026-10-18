// Filming-set build (NOT deployed): one self-contained HTML file per build, opens via file://.
//   npm run build:sets  ->  dist-sets/sets/index.html  (open with ?set=winterhaven)
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolve } from 'node:path';

export default defineConfig({
  base: './',
  publicDir: false,
  plugins: [viteSingleFile({ useRecommendedBuildConfig: false })],
  build: {
    outDir: 'dist-sets', emptyOutDir: true, chunkSizeWarningLimit: 100000000, cssCodeSplit: false, assetsInlineLimit: 100000000,
    rollupOptions: { input: resolve(__dirname, 'sets/index.html'), output: { inlineDynamicImports: true } },
  },
});
