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
  // pnpm junction の実体パスに node_modules がないため、workspace package の CJS dist は利用経路ごとに明示的に変換する。
  // preserveSymlinks は React/Mantine 系の依存解決を壊し、client optimizeDeps 単独と ssr.noExternal 単独は dev SSR に効かなかった。
  // namespace import では設定退行を build error にできないため named import を lint 強制する。失敗署名は `app/features/characterTemplate/AI.types.md` の「CJS interop の3設定」を参照。
  // @trpg/api-contract の runtime schema は resource action 専用。production image が dist をコピーしないため SSR bundle に内包し、client chunk には載せない。
  // dual build 化（ESM出力 + exports）後は build.commonjsOptions・ssr.optimizeDeps・client optimizeDeps.include の対象エントリを撤去候補とする。
  // 撤去時は `AI.types.md` の同節と `eslint.config.js` の namespace import 禁止ルールの存廃・message を更新し、dev SSR・client dev・build の3経路を再確認する。
  build: {
    commonjsOptions: {
      include: [/node_modules/, /packages[\\/](?:api-contract|sheet-engine)[\\/]dist/]
    }
  },
  ssr: {
    noExternal: ['@trpg/api-contract'],
    optimizeDeps: {
      include: ['@trpg/api-contract', '@trpg/sheet-engine']
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
