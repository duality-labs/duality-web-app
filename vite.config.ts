import { defineConfig, UserConfig } from 'vite';
import { InlineConfig } from 'vitest';
import react from '@vitejs/plugin-react';

// reference docs:
// - https://vitejs.dev/config/
// - https://vitest.dev/config/
const config: UserConfig & { test?: InlineConfig } = defineConfig({
  envPrefix: 'REACT_APP_',
  plugins: [react()],
  build: {
    outDir: 'build',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    deps: {
      optimizer: {
        web: {
          // some libraries are not ESM are require transforming
          include: ['@visx/scale'],
        },
      },
    },
  },
});

export default config;
