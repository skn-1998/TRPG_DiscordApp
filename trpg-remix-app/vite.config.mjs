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
  // Docker環境とWindows向けの最適化
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    hmr: {
      clientPort: 5173,
      host: '127.0.0.1',  // IPv6回避のため127.0.0.1を使用
      protocol: 'ws'
    },
    watch: {
      usePolling: true, // Docker環境では常にポーリングを使用
      interval: 1000, // ポーリング間隔を調整
      ignored: ['**/node_modules/**', '**/.git/**']
    }
  },
  // 依存関係の最適化設定
  optimizeDeps: {
    include: [
      '@mantine/core',
      '@mantine/hooks',
      '@mantine/form',
      '@mantine/notifications',
      '@mantine/modals',
      '@mantine/nprogress',
      '@remix-run/react',
      '@remix-run/node',
      'react',
      'react-dom',
      'lodash',
      'axios',
      'zustand'
    ],
    force: false // 強制的な依存関係最適化を無効化
  },
  // キャッシュディレクトリの設定
  cacheDir: 'node_modules/.vite'
})
