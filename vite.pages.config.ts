import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  base: '/aprende/',
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  css: { postcss: { plugins: [tailwindcss()] } },
  build: {
    outDir: 'dist-pages',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/@base-ui/')) return 'base-ui';
          if (
            id.includes('/node_modules/lucide-react/') ||
            id.includes('/node_modules/@phosphor-icons/')
          )
            return 'icons';
          if (id.includes('/node_modules/@supabase/')) return 'supabase';
        },
      },
    },
  },
});
