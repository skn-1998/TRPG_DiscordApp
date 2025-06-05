import { vitePlugin as remix } from '@remix-run/dev'
import { installGlobals } from '@remix-run/node'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { flatRoutes } from 'remix-flat-routes'
import env from 'vite-plugin-env-compatible'

installGlobals()

export default defineConfig({
  plugins: [
    remix({
      future: {
        v3_singleFetch: true,
        v3_lazyRouteDiscovery: true,
        v3_throwAbortReason: true,
        v3_relativeSplatPath: true,
        v3_fetcherPersist: true
      },
      ignoredRouteFiles: ['**/*'],
      routes: async (defineRoutes) => flatRoutes('routes', defineRoutes)
    }),
    tsconfigPaths(),
    env({ prefix: '', mountedPath: 'process.env' })
  ],
  server: {
    strictPort: true,
    hmr: {
      clientPort: 5173,
      host: 'localhost',
      protocol: 'ws'
    }
  }
})
