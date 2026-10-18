import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Single-file build: all JS/CSS is inlined into dist/index.html so the game
// works offline, from any static host, and even when opened via file://.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: { outDir: 'dist', chunkSizeWarningLimit: 2000 },
});
