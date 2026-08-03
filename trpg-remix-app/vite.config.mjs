import { vitePlugin as remix } from '@remix-run/dev'
import { installGlobals } from '@remix-run/node'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { flatRoutes } from 'remix-flat-routes'

installGlobals()

const publicEnv = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || '5173',
  DISCORD_APPLICATIONID: process.env.DISCORD_APPLICATIONID || '',
  SERVER_DOMAIN: process.env.SERVER_DOMAIN || 'http://127.0.0.1:3000',
  HOST_DOMAIN: process.env.HOST_DOMAIN || 'http://127.0.0.1:5173'
}

export default defineConfig({
  define: {
    __APP_PUBLIC_ENV__: JSON.stringify(publicEnv)
  },
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
    tsconfigPaths()
  ],
  // pnpm junction の実体パスに node_modules がないため、build・dev SSR・client dev の別パイプラインで同じ CJS dist を変換する。
  // preserveSymlinks は React/Mantine 系の依存解決を壊し、client optimizeDeps 単独と ssr.noExternal 単独は dev SSR に効かなかった。
  // 退行 + namespace import では、dev SSR は `ReferenceError: exports is not defined`、build は `MISSING_EXPORT` warning を出すが EXIT=0 になる。
  // production SSR bundle では engine 参照が tree-shake され `void 0`、production client chunk には bare `exports` 9箇所・`require(` 8箇所が残り、ブラウザでの読込時に `exports is not defined` になる。
  // named import なら build は `MISSING_EXPORT` で EXIT=1 になり、退行を止める。
  // @trpg/sheet-engine が type: commonjs の間は build・dev SSR・client dev の3設定が必要。
  // 将来 dual build 化（ESM 出力 + exports フィールド）した場合は、build.commonjsOptions と ssr.optimizeDeps の2ブロック、および client optimizeDeps.include の `@trpg/sheet-engine` 1エントリを撤去できる可能性がある（撤去時は `app/features/characterTemplate/AI.types.md` の「CJS interop の3設定」節も同時更新し、`eslint.config.js` の `@trpg/*` namespace import 禁止ルールは存置時に message の根拠を書き換え、不要なら削除する）。
  // 撤去時は dev SSR・client dev・build の3経路を再確認してから判断する。
  build: {
    commonjsOptions: {
      include: [/node_modules/, /packages[\\/]sheet-engine[\\/]dist/]
    }
  },
  ssr: {
    optimizeDeps: {
      include: ['@trpg/sheet-engine']
    }
  },
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
      // @trpg/sheet-engine の CJS dist を client dev で事前変換する。
      '@trpg/sheet-engine',
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
