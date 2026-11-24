import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const apiPort = process.env.API_PORT ?? '4108';

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.WEB_PORT ?? 5108),
    strictPort: true,
    proxy: { '/api': `http://127.0.0.1:${apiPort}` },
  },
  preview: { port: Number(process.env.WEB_PORT ?? 5108) },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.{ts,tsx}'],
    setupFiles: ['test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/roster/**', 'src/components/**', 'src/api/**'],
      thresholds: { lines: 80, functions: 70, branches: 70, statements: 80 },
    },
  },
});
