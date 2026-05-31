# Playwright 学習ロードマップ

このプロジェクト（Remix + NestJS）に特化した Playwright の学習手順です。

---

## ステップ全体像

```
Step 1: 環境構築・インストール
  ↓
Step 2: Playwright の基本概念
  ↓
Step 3: ページ操作の基礎（このプロジェクトの画面で練習）
  ↓
Step 4: このプロジェクト固有の課題（Discord OAuth2 の扱い）
  ↓
Step 5: フィクスチャ（認証状態の共有）
  ↓
Step 6: API テスト（request fixture）
  ↓
Step 7: CI 対応・レポート設定
```

---

## Step 1: 環境構築

### ディレクトリ作成とインストール

```powershell
# プロジェクトルートで実行
mkdir e2e
cd e2e
pnpm init
pnpm add -D @playwright/test

# ブラウザのダウンロード（初回のみ・時間がかかる）
pnpm exec playwright install chromium
```

### ファイル構成

```
e2e/
├── package.json
├── playwright.config.ts
├── .gitignore
└── tests/
    └── smoke.spec.ts
```

### `e2e/package.json`

```json
{
  "name": "trpg-e2e",
  "private": true,
  "scripts": {
    "test": "playwright test",
    "test:ui": "playwright test --ui",
    "test:headed": "playwright test --headed",
    "report": "playwright show-report"
  },
  "devDependencies": {
    "@playwright/test": "latest"
  }
}
```

### `e2e/playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
```

### `e2e/.gitignore`

```
test-results/
playwright-report/
.auth/
```

### 動作確認用スモークテスト

```typescript
// e2e/tests/smoke.spec.ts
import { test, expect } from '@playwright/test';

test('トップページが表示される', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/.+/);
});
```

### ルート `package.json` にスクリプト追加

```json
{
  "scripts": {
    "test:e2e": "cd e2e && pnpm test",
    "test:e2e:ui": "cd e2e && pnpm test:ui"
  }
}
```

### 動作確認

```powershell
# アプリを起動した状態で（localhost:5173 が必要）
cd e2e
pnpm exec playwright test
```

---

## Step 2: Playwright の基本概念

### 覚えるべき3つの概念

| 概念 | 説明 | 例 |
|------|------|----|
| `page` | ブラウザの1タブ。すべての操作の起点 | `await page.goto('/')` |
| `locator` | 操作する要素への参照 | `page.getByRole('button', { name: '保存' })` |
| `expect` | 検証（アサーション） | `await expect(locator).toBeVisible()` |

### 基本的な操作パターン

```typescript
// ページ移動
await page.goto('/user/character');

// クリック
await page.getByRole('button', { name: '保存' }).click();

// テキスト入力
await page.getByLabel('キャラクター名').fill('テストキャラ');

// セレクトボックス
await page.getByLabel('ゲームシステム').selectOption('CoC7');

// 要素が表示されていることを確認
await expect(page.getByText('保存しました')).toBeVisible();

// URLが変わったことを確認
await expect(page).toHaveURL('/user/character');
```

### 公式ドキュメント（ここだけ読めば十分）

- [Getting Started](https://playwright.dev/docs/intro) — 全体像
- [Locators](https://playwright.dev/docs/locators) — 要素の特定方法
- [Assertions](https://playwright.dev/docs/test-assertions) — 検証方法の一覧

---

## Step 3: ページ操作の基礎

### 練習順序（シンプルな画面から始める）

1. `/` — トップページ（ページ表示・タイトル確認）
2. `/auth/login` — ログインページ（フォーム・ボタン操作）
3. `/user/character` — 認証が必要なページ（Step 4 が必要）

### Mantine UI のセレクター戦略

このプロジェクトは Mantine UI を使用しているため、アクセシビリティ属性が充実している。

```typescript
// ✅ 推奨：壊れにくいセレクター
page.getByRole('textbox', { name: 'キャラクター名' })
page.getByRole('button', { name: '保存' })
page.getByLabel('HP')
page.getByText('キャラクター一覧')

// ⚠️ 非推奨：Mantine のクラス名はバージョンで変わる
page.locator('.mantine-TextInput-input')
page.locator('[class*="mantine"]')
```

### ログインページのテスト例

```typescript
// e2e/tests/ui/login.spec.ts
import { test, expect } from '@playwright/test';

test('ログインページが表示される', async ({ page }) => {
  await page.goto('/auth/login');
  await expect(page.getByRole('button', { name: 'Discordでログイン' })).toBeVisible();
});

test('未ログイン状態でキャラページにアクセスするとリダイレクトされる', async ({ page }) => {
  await page.goto('/user/character');
  await expect(page).toHaveURL(/login/);
});
```

---

## Step 4: Discord OAuth2 の扱い（このプロジェクト固有の最大課題）

### 問題

Discord の OAuth2 は外部サービス（`discord.com`）にリダイレクトするため、通常の E2E テストでは自動化できない。

### 解決方法A: `storageState` でセッションを保存・再利用（シンプル）

```typescript
// e2e/tests/setup/auth.setup.ts
import { test as setup } from '@playwright/test';

setup('Discord ログイン状態を保存', async ({ page }) => {
  // 手動ログイン後の状態を保存する
  // ※ 初回だけ手動でログインして状態ファイルを作成する
  await page.context().storageState({ path: 'e2e/.auth/user.json' });
});
```

```typescript
// playwright.config.ts に追加
export default defineConfig({
  // ...
  projects: [
    {
      name: 'setup',
      testMatch: '**/setup/*.setup.ts',
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json', // ← 保存したセッションを使用
      },
      dependencies: ['setup'],
    },
  ],
});
```

### 解決方法B: NestJS にテスト用エンドポイントを追加（確実）

```typescript
// TRPG-SERVER 側に追加（開発環境のみ有効にする）
// src/domains/auth/auth.controller.ts

@Post('test-login')
async testLogin(@Body() body: { discordId: string }) {
  if (process.env.NODE_ENV !== 'test') {
    throw new ForbiddenException();
  }
  return this.authService.generateTokenForTest(body.discordId);
}
```

```typescript
// e2e/fixtures/auth.fixture.ts
import { test as base, request } from '@playwright/test';

export const test = base.extend({
  authenticatedPage: async ({ page }, use) => {
    // テスト用エンドポイントでJWTを取得
    const req = await request.newContext();
    const res = await req.post('http://localhost:3000/auth/test-login', {
      data: { discordId: 'test-discord-id' }
    });
    const { accessToken } = await res.json();

    // Cookie にセット
    await page.context().addCookies([{
      name: 'access_token',
      value: accessToken,
      domain: 'localhost',
      path: '/',
    }]);

    await use(page);
  },
});
```

> **推奨**: 開発初期は方法A（storageState）でシンプルに始め、テスト数が増えたら方法Bに移行する。

---

## Step 5: フィクスチャ（認証状態の共有）

複数のテストでログイン済み状態を使い回す仕組み。

### フィクスチャの作成

```typescript
// e2e/fixtures/auth.fixture.ts
import { test as base, Page } from '@playwright/test';

type Fixtures = {
  authenticatedPage: Page;
};

export const test = base.extend<Fixtures>({
  authenticatedPage: async ({ page }, use) => {
    // ログイン処理（Step 4 の方法A or B を使う）
    await page.context().storageState({ path: 'e2e/.auth/user.json' });
    await use(page);
  },
});

export { expect } from '@playwright/test';
```

### フィクスチャを使ったテスト

```typescript
// e2e/tests/ui/character.spec.ts
import { test, expect } from '../fixtures/auth.fixture';

test('ログイン後にキャラクター一覧が表示される', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/user/character');
  await expect(authenticatedPage.getByText('キャラクター')).toBeVisible();
});
```

---

## Step 6: API テスト（request fixture）

Playwright の `request` fixture を使うと、ブラウザなしで HTTP リクエストを送れる。  
NestJS の API に対して UI テストと同じファイルで書ける。

### 基本的な API テスト

```typescript
// e2e/tests/api/character.spec.ts
import { test, expect } from '@playwright/test';

test.describe('キャラクター API', () => {
  test('一覧取得が200を返す', async ({ request }) => {
    const response = await request.get('http://localhost:3000/characters', {
      headers: {
        Authorization: `Bearer ${process.env.TEST_JWT}`,
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body)).toBeTruthy();
  });

  test('存在しないキャラクターは404を返す', async ({ request }) => {
    const response = await request.get('http://localhost:3000/characters/nonexistent-id', {
      headers: { Authorization: `Bearer ${process.env.TEST_JWT}` },
    });

    expect(response.status()).toBe(404);
  });
});
```

### `playwright.config.ts` に API 用のプロジェクトを追加

```typescript
projects: [
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'] },
  },
  {
    name: 'api',
    use: {
      baseURL: 'http://localhost:3000', // NestJS を向く
    },
    testMatch: '**/api/**/*.spec.ts',
  },
],
```

---

## Step 7: CI 対応

### `playwright.config.ts` の本番設定

```typescript
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,         // CI では失敗時に2回リトライ
  workers: process.env.CI ? 1 : undefined,  // CI では直列実行（安定性重視）
  reporter: process.env.CI ? 'github' : 'html',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',   // 失敗時のみスクリーンショット保存
    video: 'on-first-retry',         // 失敗時のみ動画保存
  },
});
```

### GitHub Actions の例

```yaml
# .github/workflows/e2e.yml
name: E2E Tests
on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - name: Install dependencies
        run: cd e2e && pnpm install
      - name: Install Playwright browsers
        run: cd e2e && pnpm exec playwright install --with-deps chromium
      - name: Start services
        run: docker compose up -d
      - name: Run E2E tests
        run: cd e2e && pnpm test
      - name: Upload report
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: e2e/playwright-report/
```

---

## 学習の優先順位まとめ

| 優先度 | ステップ | 目安時間 |
|--------|----------|----------|
| 最優先 | Step 1: 環境構築 + スモークテスト動作確認 | 1〜2時間 |
| 高 | Step 2-3: 基本操作 + ログインページのテスト | 2〜3時間 |
| 高 | Step 4: Discord OAuth2 の方針決定 | 要議論 |
| 中 | Step 5: フィクスチャで認証状態を共有 | 1〜2時間 |
| 中 | Step 6: API テスト | 1時間 |
| 低 | Step 7: CI 対応 | 必要になったとき |

> **最初に決めておくべきこと**: Step 4 の Discord OAuth2 の扱い方針。  
> ここを設計しておくと、認証が絡む全テストがスムーズに書けます。
