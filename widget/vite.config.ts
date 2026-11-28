import { defineConfig } from 'vite'

// One self-contained IIFE file, no runtime dependencies. `--mode test` adds the test driver hooks.
export default defineConfig(({ mode }) => ({
  define: { __URIMAI_TEST__: JSON.stringify(mode === 'test') },
  build: {
    target: 'es2018',
    outDir: mode === 'test' ? 'dist-test/v1' : 'dist',
    emptyOutDir: true,
    lib: { entry: 'src/main.ts', name: 'UrimaiWidget', formats: ['iife'], fileName: () => 'widget.js' },
  },
  test: { environment: 'jsdom', include: ['tests/unit/**/*.test.ts'] },
}))
