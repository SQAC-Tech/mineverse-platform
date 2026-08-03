import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Mirrors the `@/*` path alias from tsconfig.json so unit tests can import
// application modules directly instead of only pure `contracts.ts` files.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
