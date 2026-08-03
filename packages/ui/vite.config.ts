import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Portul 1420 este cel asteptat de shell-ul Tauri (apps/desktop).
export default defineConfig({
  plugins: [
    react(),
    // Faza 5: acces web instalabil + offline (service worker cu auto-update).
    VitePWA({
      registerType: 'autoUpdate',
      workbox: { globPatterns: ['**/*.{js,css,html,svg,woff2}'] },
      manifest: {
        name: 'Gestiune & Contabilitate',
        short_name: 'Gestiune',
        description: 'Gestiune si contabilitate cross-platform, offline-first',
        lang: 'ro',
        theme_color: '#0a84ff',
        background_color: '#0f1720',
        display: 'standalone',
        start_url: '/',
      },
    }),
  ],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: '0.0.0.0',
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
  },
});
