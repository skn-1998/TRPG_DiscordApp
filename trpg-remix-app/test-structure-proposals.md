# Remixクライアントのテストコード構成提案

## 概要

このドキュメントでは、TRPGアプリケーションのRemixクライアント向けに、複数のテストコード構成案を提案します。各提案は、現在のfeature-based architectureを考慮し、モダンなテスト戦略に基づいています。

## 現在のプロジェクト構成

```
trpg-remix-app/
├── app/
│   ├── features/
│   │   ├── character/
│   │   ├── auth/
│   │   ├── scenario/
│   │   ├── users/
│   │   ├── discord/
│   │   └── mock/
│   ├── components/
│   │   ├── Head/
│   │   ├── Layouts/
│   │   ├── Elements/
│   │   └── Form/
│   ├── routes/
│   ├── hooks/
│   ├── utils/
│   └── types/
├── jest.config.cjs
└── package.json
```

## テスト構成提案

### 提案1: Feature-based Testing Structure（推奨）

この構成は、現在のfeature-based architectureを活用し、各機能に対応したテストを配置します。

```
trpg-remix-app/
├── app/
│   ├── features/
│   │   ├── character/
│   │   │   ├── components/
│   │   │   │   ├── CharacterCard.tsx
│   │   │   │   └── CharacterForm.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useCharacter.ts
│   │   │   ├── services/
│   │   │   │   └── characterService.ts
│   │   │   └── __tests__/
│   │   │       ├── components/
│   │   │       │   ├── CharacterCard.test.tsx
│   │   │       │   └── CharacterForm.test.tsx
│   │   │       ├── hooks/
│   │   │       │   └── useCharacter.test.ts
│   │   │       └── services/
│   │   │           └── characterService.test.ts
│   │   ├── auth/
│   │   │   └── __tests__/
│   │   │       ├── components/
│   │   │       ├── hooks/
│   │   │       └── services/
│   │   └── scenario/
│   │       └── __tests__/
│   │           ├── components/
│   │           ├── hooks/
│   │           └── services/
│   ├── components/
│   │   ├── Elements/
│   │   │   ├── Button/
│   │   │   │   ├── Button.tsx
│   │   │   │   └── Button.test.tsx
│   │   │   └── Modal/
│   │   │       ├── Modal.tsx
│   │   │       └── Modal.test.tsx
│   └── routes/
│       └── __tests__/
│           ├── integration/
│           └── e2e/
├── __tests__/
│   ├── setup.ts
│   ├── utils/
│   │   ├── test-utils.tsx
│   │   └── mocks/
│   │       ├── handlers.ts
│   │       └── server.ts
│   └── fixtures/
│       ├── character.ts
│       ├── scenario.ts
│       └── user.ts
└── vitest.config.ts
```

**メリット：**
- 現在のアーキテクチャと整合性が取れている
- 各機能のテストが隔離されている
- 新機能追加時にテストディレクトリも自然に作成される

**デメリット：**
- 共通テストユーティリティが散在する可能性

### 提案2: Test-Type-based Structure

テストの種類ごとに明確に分離された構成です。

```
trpg-remix-app/
├── app/
│   └── [既存の構成]
├── tests/
│   ├── unit/
│   │   ├── features/
│   │   │   ├── character/
│   │   │   │   ├── services/
│   │   │   │   │   └── characterService.test.ts
│   │   │   │   └── hooks/
│   │   │   │       └── useCharacter.test.ts
│   │   │   ├── auth/
│   │   │   └── scenario/
│   │   └── utils/
│   │       ├── validation.test.ts
│   │       └── formatting.test.ts
│   ├── integration/
│   │   ├── features/
│   │   │   ├── character/
│   │   │   │   ├── CharacterFlow.test.tsx
│   │   │   │   └── CharacterManagement.test.tsx
│   │   │   ├── auth/
│   │   │   │   └── AuthFlow.test.tsx
│   │   │   └── scenario/
│   │   │       └── ScenarioFlow.test.tsx
│   │   └── routes/
│   │       ├── character.test.tsx
│   │       └── scenario.test.tsx
│   ├── component/
│   │   ├── features/
│   │   │   ├── character/
│   │   │   │   ├── CharacterCard.test.tsx
│   │   │   │   └── CharacterForm.test.tsx
│   │   │   ├── auth/
│   │   │   └── scenario/
│   │   └── ui/
│   │       ├── Button.test.tsx
│   │       ├── Modal.test.tsx
│   │       └── Form.test.tsx
│   ├── e2e/
│   │   ├── character-management.spec.ts
│   │   ├── scenario-creation.spec.ts
│   │   └── user-auth.spec.ts
│   ├── visual/
│   │   ├── components/
│   │   └── pages/
│   └── utils/
│       ├── test-utils.tsx
│       ├── mocks/
│       └── fixtures/
└── playwright.config.ts
```

**メリット：**
- テストの種類が明確に分離されている
- 各テストタイプの設定が独立している
- 大規模チームでの役割分担が明確

**デメリット：**
- 機能追加時に複数のディレクトリを更新する必要
- コードとテストの物理的距離が遠い

### 提案3: Hybrid Structure（バランス重視）

Feature-basedとTest-type-basedの利点を組み合わせた構成です。

```
trpg-remix-app/
├── app/
│   ├── features/
│   │   ├── character/
│   │   │   ├── components/
│   │   │   │   ├── CharacterCard.tsx
│   │   │   │   └── CharacterCard.test.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useCharacter.ts
│   │   │   │   └── useCharacter.test.ts
│   │   │   ├── services/
│   │   │   │   ├── characterService.ts
│   │   │   │   └── characterService.test.ts
│   │   │   └── __tests__/
│   │   │       └── integration/
│   │   │           └── CharacterFlow.test.tsx
│   │   ├── auth/
│   │   └── scenario/
│   ├── components/
│   │   ├── Elements/
│   │   │   ├── Button/
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Button.test.tsx
│   │   │   │   └── Button.stories.tsx
│   │   │   └── Modal/
│   │   └── Layouts/
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   └── useAuth.test.ts
│   └── utils/
│       ├── validation.ts
│       └── validation.test.ts
├── __tests__/
│   ├── e2e/
│   │   ├── character-management.spec.ts
│   │   ├── scenario-creation.spec.ts
│   │   └── user-auth.spec.ts
│   ├── visual/
│   │   ├── components/
│   │   └── pages/
│   └── setup/
│       ├── test-utils.tsx
│       ├── mocks/
│       └── fixtures/
└── [設定ファイル]
```

**メリット：**
- 単体テストはコードと近接配置
- 複雑なテスト（E2E, Visual）は分離
- 開発時の利便性と保守性のバランス

**デメリット：**
- 複数のテスト配置パターンが混在

### 提案4: Storybook + Testing Library統合構成

Storybookを中心としたコンポーネント駆動開発に最適化された構成です。

```
trpg-remix-app/
├── app/
│   └── [既存の構成]
├── stories/
│   ├── features/
│   │   ├── character/
│   │   │   ├── CharacterCard.stories.tsx
│   │   │   ├── CharacterCard.test.tsx
│   │   │   ├── CharacterForm.stories.tsx
│   │   │   └── CharacterForm.test.tsx
│   │   ├── auth/
│   │   └── scenario/
│   ├── components/
│   │   ├── Elements/
│   │   │   ├── Button/
│   │   │   │   ├── Button.stories.tsx
│   │   │   │   └── Button.test.tsx
│   │   │   └── Modal/
│   │   └── Layouts/
│   └── pages/
│       ├── CharacterPage.stories.tsx
│       └── ScenarioPage.stories.tsx
├── __tests__/
│   ├── integration/
│   ├── e2e/
│   └── utils/
└── .storybook/
    ├── main.ts
    ├── preview.ts
    └── test-runner.ts
```

**メリット：**
- Storybookとテストが統合された開発体験
- コンポーネントのVisual Testing自動化
- デザインシステムの一貫性確保

**デメリット：**
- Storybookのセットアップが必要
- 学習コストが高い

## 推奨する設定ファイル

### 1. vitest.config.ts（Jest設定を置換）

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.stories.tsx',
        '**/*.test.tsx',
        '**/*.spec.tsx',
      ],
    },
  },
  resolve: {
    alias: {
      '~': resolve(__dirname, './app'),
    },
  },
});
```

### 2. テストユーティリティ（test-utils.tsx）

```typescript
import { render, RenderOptions } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { ReactElement } from 'react';
import { BrowserRouter } from 'react-router-dom';

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  withRouter?: boolean;
  mantineTheme?: any;
}

const AllTheProviders = ({ children, withRouter = true, mantineTheme = {} }) => {
  const content = (
    <MantineProvider theme={mantineTheme}>
      {children}
    </MantineProvider>
  );

  if (withRouter) {
    return <BrowserRouter>{content}</BrowserRouter>;
  }

  return content;
};

const customRender = (
  ui: ReactElement,
  options: CustomRenderOptions = {}
) => {
  const { withRouter, mantineTheme, ...renderOptions } = options;
  
  return render(ui, {
    wrapper: (props) => AllTheProviders({ ...props, withRouter, mantineTheme }),
    ...renderOptions,
  });
};

export * from '@testing-library/react';
export { customRender as render };
```

### 3. MSW（Mock Service Worker）設定

```typescript
// __tests__/mocks/handlers.ts
import { rest } from 'msw';

export const handlers = [
  rest.get('/api/characters', (req, res, ctx) => {
    return res(
      ctx.json([
        { id: 1, name: 'テストキャラクター', level: 1 },
      ])
    );
  }),

  rest.post('/api/characters', (req, res, ctx) => {
    return res(
      ctx.json({ id: 2, name: 'New Character', level: 1 })
    );
  }),
];

// __tests__/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

### 4. Playwright設定（E2Eテスト）

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './__tests__/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

## 各提案の比較

| 提案 | 保守性 | 学習コスト | 現在の構成との整合性 | 推奨度 |
|------|--------|------------|----------------------|--------|
| Feature-based | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 高 |
| Test-Type-based | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | 中 |
| Hybrid | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | 高 |
| Storybook統合 | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | 中 |

## 実装手順

### Phase 1: 基本設定
1. Vitestへの移行（Jest設定を置換）
2. テストユーティリティの作成
3. MSWの設定

### Phase 2: 単体テスト
1. ユーティリティ関数のテスト
2. カスタムフックのテスト
3. サービス層のテスト

### Phase 3: コンポーネントテスト
1. 基本コンポーネントのテスト
2. 機能コンポーネントのテスト
3. アクセシビリティテストの追加

### Phase 4: 統合テスト
1. 機能フロー全体のテスト
2. ルーティングのテスト
3. 状態管理のテスト

### Phase 5: E2Eテスト
1. 主要ユーザーフローのテスト
2. 認証フローのテスト
3. CRUD操作のテスト

## 結論

現在のプロジェクト構成を考慮すると、**提案1: Feature-based Testing Structure**が最も適切と考えられます。

理由：
- 現在のfeature-based architectureとの整合性が高い
- 開発チームの認知負荷が少ない
- 機能追加時のテスト追加が自然
- 保守性が高い

次点として**提案3: Hybrid Structure**も検討に値しますが、まずは提案1から始めて、必要に応じて段階的に拡張することを推奨します。