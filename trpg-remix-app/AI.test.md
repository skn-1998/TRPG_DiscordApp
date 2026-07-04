# フロントエンドテスト

- Unit test: Jest + ts-jest
- Type check: `pnpm run typecheck`
- Lint: `pnpm run lint`
- Production build: `pnpm run build`

テストは`app/**/*.spec.ts(x)`または`app/**/__tests__/`へ置く。認証ではtokenやcodeの実値をfixture・snapshot・ログへ残さない。
