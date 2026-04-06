import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: {
              external: ['express'],
              output: {
                format: 'cjs'
              }
            }
          }
        }
      },
      {
        entry: 'electron/preload.ts',
        vite: {
          build: {
            rollupOptions: {
              output: {
                format: 'cjs'
              }
            }
          }
        }
      },
      {
        entry: 'electron/trailer-preload.js',
        onhighlight: true,
        vite: {
          build: {
            rollupOptions: {
              output: {
                format: 'cjs',
                entryFileNames: 'trailer-preload.js'
              }
            }
          }
        }
      },
    ]),
    renderer(),
  ],
  css: {
    postcss: './postcss.config.js',
  },
})