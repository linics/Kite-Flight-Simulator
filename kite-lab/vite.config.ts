import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(() => ({
  base: './',
  publicDir: 'public',
  build: {
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
      output: [
        {
          format: 'es',
          entryFileNames: 'assets/[name].js',
          chunkFileNames: 'assets/[name].js',
          assetFileNames: 'assets/[name][extname]'
        },
        {
          format: 'umd',
          name: 'KiteLab',
          entryFileNames: 'kite-lab.umd.js',
          chunkFileNames: 'kite-lab.[name].js',
          assetFileNames: 'kite-lab.[name][extname]',
          inlineDynamicImports: true,
          exports: 'named'
        }
      ]
    }
  }
}));
