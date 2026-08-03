import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Config separat de vite.config.ts (care incarca VitePWA — inutil si mai lent
// sub test). Ruleaza componentele in jsdom, cu matchers jest-dom.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    css: false,
  },
});
