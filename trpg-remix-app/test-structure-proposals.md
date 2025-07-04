# TRPG-Remix-App テストコード構成提案（AI.md基準）

## 概要

このドキュメントでは、AI.mdの詳細な分析に基づき、TRPGアプリケーションのRemixクライアント向けに、複数のテストコード構成案を提案します。現在のfeature-based architecture、Discord OAuth認証、セキュリティ要件を考慮した実践的なテスト戦略を提供します。

## 現在のプロジェクト状況（AI.md分析結果）

### 技術スタック
- **フレームワーク**: Remix v2 + TypeScript
- **UIライブラリ**: Mantine v7
- **状態管理**: Zustand + Immer
- **認証**: Discord OAuth2 + JWT
- **API通信**: Axios + 認証インターセプター
- **テスト**: **未実装**（最優先実装項目）

### 現在のアーキテクチャ

```
trpg-remix-app/
├── app/
│   ├── features/                # フィーチャードリブン設計
│   │   ├── auth/               # Discord OAuth認証
│   │   ├── character/          # キャラクター管理
│   │   ├── users/              # ユーザー管理
│   │   ├── scenario/           # シナリオ管理
│   │   ├── discord/            # Discord API連携
│   │   └── mock/               # モックデータ
│   ├── components/
│   │   ├── Elements/           # Atomic Design influenced
│   │   ├── Layouts/            # レイアウト
│   │   ├── Form/               # フォーム
│   │   └── Head/               # ヘッダー管理
│   ├── routes/                 # Remix Flat Routes
│   ├── lib/                    # APIクライアント、共通フック
│   ├── store/                  # Zustand状態管理
│   ├── config/                 # 設定管理
│   └── types/                  # 型定義
├── jest.config.cjs            # 現在のJest設定
└── package.json
```

### 重要な特徴
- **セキュリティ重視**: Discord OAuth、JWT、暗号化
- **複雑な認証フロー**: クライアント⇔サーバー⇔Discord API
- **SSR/SPA ハイブリッド**: Remix loader/action パターン
- **既存モック**: 開発用モック機能が存在

## テスト構成提案

### 提案1: TRPG Feature-based Testing Structure（推奨）

現在のfeature-based architectureとTRPGアプリケーションの特性を活用した構成です。

```
trpg-remix-app/
├── app/
│   ├── features/
│   │   ├── auth/                    # Discord OAuth認証
│   │   │   ├── components/
│   │   │   │   ├── LoginButton.tsx
│   │   │   │   └── AuthStatus.tsx
│   │   │   ├── api/
│   │   │   │   └── authService.ts
│   │   │   └── __tests__/
│   │   │       ├── components/
│   │   │       │   ├── LoginButton.test.tsx
│   │   │       │   └── AuthStatus.test.tsx
│   │   │       ├── api/
│   │   │       │   └── authService.test.ts
│   │   │       └── integration/
│   │   │           └── discord-auth-flow.test.tsx
│   │   ├── character/               # キャラクター管理
│   │   │   ├── components/
│   │   │   │   ├── CharacterCard.tsx
│   │   │   │   ├── CharacterForm.tsx
│   │   │   │   └── CharacterList.tsx
│   │   │   ├── edit/
│   │   │   │   └── CharacterEditForm.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useCharacter.ts
│   │   │   ├── api/
│   │   │   │   └── characterService.ts
│   │   │   └── __tests__/
│   │   │       ├── components/
│   │   │       │   ├── CharacterCard.test.tsx
│   │   │       │   ├── CharacterForm.test.tsx
│   │   │       │   └── CharacterList.test.tsx
│   │   │       ├── hooks/
│   │   │       │   └── useCharacter.test.ts
│   │   │       ├── api/
│   │   │       │   └── characterService.test.ts
│   │   │       └── integration/
│   │   │           └── character-crud.test.tsx
│   │   ├── users/                   # ユーザー管理
│   │   │   └── __tests__/
│   │   │       ├── components/
│   │   │       ├── api/
│   │   │       └── integration/
│   │   ├── scenario/                # シナリオ管理
│   │   │   └── __tests__/
│   │   │       ├── components/
│   │   │       ├── api/
│   │   │       └── integration/
│   │   ├── discord/                 # Discord API連携
│   │   │   ├── components/
│   │   │   │   ├── GuildList.tsx
│   │   │   │   └── DiscordStatus.tsx
│   │   │   ├── api/
│   │   │   │   └── discordService.ts
│   │   │   └── __tests__/
│   │   │       ├── components/
│   │   │       │   ├── GuildList.test.tsx
│   │   │       │   └── DiscordStatus.test.tsx
│   │   │       ├── api/
│   │   │       │   └── discordService.test.ts
│   │   │       └── integration/
│   │   │           └── discord-api.test.tsx
│   │   └── mock/                    # モック機能
│   │       ├── components/
│   │       │   └── MockDataPanel.tsx
│   │       └── __tests__/
│   │           └── components/
│   │               └── MockDataPanel.test.tsx
│   ├── components/                  # 共通コンポーネント
│   │   ├── Elements/
│   │   │   ├── Button/
│   │   │   │   ├── Button.tsx
│   │   │   │   └── Button.test.tsx
│   │   │   └── Modal/
│   │   │       ├── Modal.tsx
│   │   │       └── Modal.test.tsx
│   │   ├── Layouts/
│   │   │   ├── AppLayout.tsx
│   │   │   ├── Header.tsx
│   │   │   └── __tests__/
│   │   │       ├── AppLayout.test.tsx
│   │   │       └── Header.test.tsx
│   │   └── Form/
│   │       └── __tests__/
│   ├── routes/                      # Remix routes
│   │   └── __tests__/
│   │       ├── routes/
│   │       │   ├── index.test.tsx
│   │       │   ├── character.$id.test.tsx
│   │       │   └── auth.login.test.tsx
│   │       └── integration/
│   │           └── navigation.test.tsx
│   ├── lib/                         # 共通ライブラリ
│   │   ├── api-client.ts
│   │   ├── gameSystem.ts
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   └── useCharacters.ts
│   │   └── __tests__/
│   │       ├── api-client.test.ts
│   │       ├── gameSystem.test.ts
│   │       └── hooks/
│   │           ├── useAuth.test.ts
│   │           └── useCharacters.test.ts
│   ├── store/                       # Zustand状態管理
│   │   ├── index.ts
│   │   ├── authSlice.ts
│   │   ├── characterSlice.ts
│   │   └── __tests__/
│   │       ├── authSlice.test.ts
│   │       └── characterSlice.test.ts
│   └── config/                      # 設定管理
│       ├── configuration.ts
│       └── __tests__/
│           └── configuration.test.ts
├── __tests__/                       # テスト設定・共通ファイル
│   ├── setup.ts                     # Vitest設定
│   ├── utils/
│   │   ├── test-utils.tsx           # Mantine + Remix対応
│   │   ├── auth-utils.ts            # 認証テストユーティリティ
│   │   └── mocks/
│   │       ├── handlers.ts          # MSW API handlers
│   │       ├── server.ts            # MSW server
│   │       ├── discord-api.ts       # Discord API mock
│   │       └── jwt-mock.ts          # JWT mock
│   ├── fixtures/                    # テストデータ
│   │   ├── character.ts
│   │   ├── scenario.ts
│   │   ├── user.ts
│   │   ├── discord-guild.ts
│   │   └── auth-response.ts
│   └── e2e/                         # E2Eテスト
│       ├── auth-flow.spec.ts
│       ├── character-management.spec.ts
│       ├── discord-integration.spec.ts
│       └── user-journey.spec.ts
└── vitest.config.ts
```

**メリット：**
- 現在のTRPGアプリケーションアーキテクチャと完全に整合
- Discord OAuth認証の複雑さに対応
- 各機能のテストが隔離され、開発チームが理解しやすい
- 既存のモック機能を活用可能

**デメリット：**
- 初期セットアップが複雑
- 認証フローのテストが技術的に困難

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

## TRPG専用設定ファイル

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
    setupFiles: ['./app/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'app/__tests__/',
        '**/*.d.ts',
        '**/*.stories.tsx',
        '**/*.test.tsx',
        '**/*.spec.tsx',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
  },
  resolve: {
    alias: {
      '~': resolve(__dirname, './app'),
    },
  },
  // IPv4強制（Docker環境対応）
  server: {
    host: '0.0.0.0',
    port: 3001,
  },
});
```

### 2. テストユーティリティ（test-utils.tsx）

```typescript
import { render, RenderOptions } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { ReactElement } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { theme } from '~/theme';
import { configService } from '~/config/config.service';

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  withRouter?: boolean;
  mantineTheme?: any;
  authenticated?: boolean;
  user?: any;
}

// TRPG専用のテストプロバイダー
const TRPGTestProviders = ({ 
  children, 
  withRouter = true, 
  mantineTheme = theme,
  authenticated = false,
  user = null 
}) => {
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
  const { withRouter, mantineTheme, authenticated, user, ...renderOptions } = options;
  
  return render(ui, {
    wrapper: (props) => TRPGTestProviders({ 
      ...props, 
      withRouter, 
      mantineTheme,
      authenticated,
      user
    }),
    ...renderOptions,
  });
};

export * from '@testing-library/react';
export { customRender as render };
```

### 3. 認証テストユーティリティ（auth-utils.ts）

```typescript
import { rest } from 'msw';
import { server } from './mocks/server';

// Discord OAuth認証のモック
export const mockDiscordAuth = (options = {}) => {
  const defaultAuth = {
    access_token: 'mock-discord-access-token',
    refresh_token: 'mock-discord-refresh-token',
    expires_in: 3600,
    token_type: 'Bearer',
    scope: 'identify guilds',
  };

  server.use(
    rest.post('/api/auth/discord/callback', (req, res, ctx) => {
      return res(ctx.json({ ...defaultAuth, ...options }));
    })
  );
};

// JWT認証のモック
export const mockJWTAuth = (user = null) => {
  const defaultUser = {
    id: 'test-user-id',
    discordUserId: 'test-discord-user-id',
    name: 'テストユーザー',
    avatar: 'https://example.com/avatar.jpg',
  };

  server.use(
    rest.get('/api/auth/validate-token', (req, res, ctx) => {
      return res(ctx.json({ 
        success: true, 
        user: user || defaultUser 
      }));
    })
  );
};

// 認証失敗のモック
export const mockAuthFailure = (errorType = 'unauthorized') => {
  server.use(
    rest.get('/api/auth/validate-token', (req, res, ctx) => {
      return res(
        ctx.status(401),
        ctx.json({ success: false, error: errorType })
      );
    })
  );
};
```

### 4. MSW設定（TRPG API対応）

```typescript
// __tests__/mocks/handlers.ts
import { rest } from 'msw';

export const handlers = [
  // キャラクター管理API
  rest.get('/api/characters', (req, res, ctx) => {
    return res(
      ctx.json([
        { 
          id: 1, 
          name: 'テストキャラクター', 
          level: 1, 
          gameSystem: 'D&D 5e',
          userId: 'test-user-id'
        },
      ])
    );
  }),

  rest.post('/api/characters', (req, res, ctx) => {
    return res(
      ctx.json({ 
        id: 2, 
        name: 'New Character', 
        level: 1,
        gameSystem: 'D&D 5e',
        userId: 'test-user-id'
      })
    );
  }),

  // Discord API
  rest.get('/api/auth/guilds/:userId', (req, res, ctx) => {
    return res(
      ctx.json({
        guilds: [
          {
            id: 'test-guild-id',
            name: 'テストTRPGサーバー',
            icon: 'guild-icon.png',
            permissions: '8',
          },
        ],
      })
    );
  }),

  // 認証API
  rest.get('/api/auth/validate-token', (req, res, ctx) => {
    return res(
      ctx.json({
        success: true,
        user: {
          id: 'test-user-id',
          discordUserId: 'test-discord-user-id',
          name: 'テストユーザー',
          avatar: 'https://example.com/avatar.jpg',
        },
      })
    );
  }),

  // シナリオ管理API
  rest.get('/api/scenarios', (req, res, ctx) => {
    return res(
      ctx.json([
        {
          id: 1,
          title: 'テストシナリオ',
          description: 'テスト用のシナリオです',
          gameSystem: 'D&D 5e',
          authorId: 'test-user-id',
        },
      ])
    );
  }),
];

// __tests__/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

### 5. テストデータ（fixtures）

```typescript
// __tests__/fixtures/character.ts
export const mockCharacter = {
  id: 1,
  name: 'テストキャラクター',
  level: 1,
  gameSystem: 'D&D 5e',
  userId: 'test-user-id',
  stats: {
    hp: 10,
    mp: 5,
    strength: 12,
    dexterity: 14,
    constitution: 13,
    intelligence: 15,
    wisdom: 11,
    charisma: 16,
  },
  equipment: [
    { name: 'ロングソード', type: 'weapon', damage: '1d8' },
    { name: 'レザーアーマー', type: 'armor', ac: 11 },
  ],
};

// __tests__/fixtures/discord-guild.ts
export const mockDiscordGuild = {
  id: 'test-guild-id',
  name: 'テストTRPGサーバー',
  icon: 'guild-icon.png',
  permissions: '8',
  channels: [
    {
      id: 'test-channel-id',
      name: 'general',
      type: 'text',
    },
  ],
};

// __tests__/fixtures/auth-response.ts
export const mockAuthResponse = {
  success: true,
  user: {
    id: 'test-user-id',
    discordUserId: 'test-discord-user-id',
    name: 'テストユーザー',
    avatar: 'https://example.com/avatar.jpg',
  },
  token: 'mock-jwt-token',
};
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

## 実装例（TRPG専用）

### 1. 認証フローのテスト例

```typescript
// app/features/auth/__tests__/integration/discord-auth-flow.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { mockDiscordAuth, mockJWTAuth } from '~/tests/utils/auth-utils';
import { LoginButton } from '../components/LoginButton';
import { server } from '~/tests/mocks/server';

describe('Discord認証フロー', () => {
  beforeEach(() => {
    server.listen();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  it('Discordログインボタンクリック後、認証フローが開始される', async () => {
    mockDiscordAuth();
    mockJWTAuth();
    
    render(<LoginButton />);
    
    const loginButton = screen.getByRole('button', { name: /Discordでログイン/i });
    fireEvent.click(loginButton);
    
    await waitFor(() => {
      expect(screen.getByText('認証中...')).toBeInTheDocument();
    });
    
    await waitFor(() => {
      expect(screen.getByText('ログイン成功')).toBeInTheDocument();
    });
  });

  it('認証失敗時、エラーメッセージが表示される', async () => {
    mockAuthFailure('discord_error');
    
    render(<LoginButton />);
    
    const loginButton = screen.getByRole('button', { name: /Discordでログイン/i });
    fireEvent.click(loginButton);
    
    await waitFor(() => {
      expect(screen.getByText('認証に失敗しました')).toBeInTheDocument();
    });
  });
});
```

### 2. キャラクター管理のテスト例

```typescript
// app/features/character/__tests__/integration/character-crud.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CharacterList } from '../components/CharacterList';
import { CharacterForm } from '../components/CharacterForm';
import { mockCharacter } from '~/tests/fixtures/character';
import { server } from '~/tests/mocks/server';

describe('キャラクター管理', () => {
  beforeEach(() => {
    server.listen();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  it('キャラクター一覧が表示される', async () => {
    render(<CharacterList />, { authenticated: true });
    
    await waitFor(() => {
      expect(screen.getByText('テストキャラクター')).toBeInTheDocument();
      expect(screen.getByText('D&D 5e')).toBeInTheDocument();
      expect(screen.getByText('レベル: 1')).toBeInTheDocument();
    });
  });

  it('新規キャラクターを作成できる', async () => {
    render(<CharacterForm />, { authenticated: true });
    
    const nameInput = screen.getByLabelText('キャラクター名');
    const levelInput = screen.getByLabelText('レベル');
    const submitButton = screen.getByRole('button', { name: /作成/i });
    
    fireEvent.change(nameInput, { target: { value: '新キャラクター' } });
    fireEvent.change(levelInput, { target: { value: '5' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('キャラクターが作成されました')).toBeInTheDocument();
    });
  });
});
```

### 3. Discord連携のテスト例

```typescript
// app/features/discord/__tests__/integration/discord-api.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { GuildList } from '../components/GuildList';
import { mockDiscordGuild } from '~/tests/fixtures/discord-guild';
import { server } from '~/tests/mocks/server';

describe('Discord連携', () => {
  beforeEach(() => {
    server.listen();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  it('参加中のDiscordサーバーが表示される', async () => {
    render(<GuildList />, { 
      authenticated: true, 
      user: { discordUserId: 'test-discord-user-id' }
    });
    
    await waitFor(() => {
      expect(screen.getByText('テストTRPGサーバー')).toBeInTheDocument();
    });
  });
});
```

### 4. E2Eテスト例

```typescript
// __tests__/e2e/auth-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('認証フロー', () => {
  test('Discord認証からキャラクター作成まで', async ({ page }) => {
    // ホームページにアクセス
    await page.goto('/');
    
    // ログインボタンをクリック
    await page.click('text=Discordでログイン');
    
    // Discord認証（モック）
    await page.waitForSelector('text=認証中...');
    await page.waitForSelector('text=ログイン成功');
    
    // キャラクター作成ページに移動
    await page.click('text=新規キャラクター作成');
    
    // キャラクター情報入力
    await page.fill('input[name="name"]', 'E2Eテストキャラクター');
    await page.selectOption('select[name="gameSystem"]', 'D&D 5e');
    await page.fill('input[name="level"]', '1');
    
    // 作成ボタンクリック
    await page.click('button[type="submit"]');
    
    // 作成成功確認
    await expect(page.locator('text=キャラクターが作成されました')).toBeVisible();
    
    // キャラクター一覧に移動
    await page.click('text=キャラクター一覧');
    
    // 作成したキャラクターが表示されることを確認
    await expect(page.locator('text=E2Eテストキャラクター')).toBeVisible();
  });
});
```

## 段階的実装ロードマップ

### Phase 1: 基本セットアップ（1週間）
1. **Vitestへの移行**
   - Jest設定の置換
   - 既存のテストライブラリ依存関係の更新
   - IPv4強制設定（Docker環境対応）

2. **テストユーティリティの作成**
   - Mantine + Remix対応のテストユーティリティ
   - 認証テストユーティリティ
   - MSWサーバーの設定

3. **基本的なモック設定**
   - Discord API mock
   - JWT認証 mock
   - 基本的なTRPG APIエンドポイント

### Phase 2: 認証・セキュリティテスト（2週間）
1. **認証フローのテスト**
   - Discord OAuth認証テスト
   - JWT検証テスト
   - 認証失敗時のエラーハンドリング

2. **セキュリティテスト**
   - 認証が必要なAPIアクセステスト
   - 認証情報の適切な管理テスト
   - セッション管理テスト

### Phase 3: 機能別テスト（3週間）
1. **キャラクター管理テスト**
   - CRUD操作のテスト
   - バリデーションテスト
   - 複数ゲームシステム対応テスト

2. **Discord連携テスト**
   - Guild一覧取得テスト
   - チャンネル連携テスト
   - 権限管理テスト

3. **その他機能テスト**
   - シナリオ管理テスト
   - ユーザー管理テスト
   - モック機能テスト

### Phase 4: 統合・E2Eテスト（2週間）
1. **統合テスト**
   - 複数機能間の連携テスト
   - 状態管理（Zustand）テスト
   - Remix loader/actionテスト

2. **E2Eテスト**
   - 主要ユーザーフローのテスト
   - 認証フロー全体のテスト
   - クロスブラウザテスト

### Phase 5: 最適化・CI/CD（1週間）
1. **パフォーマンス最適化**
   - テスト実行時間の短縮
   - 並列実行の最適化
   - カバレッジ目標の設定

2. **CI/CD統合**
   - GitHub Actions設定
   - テスト結果の自動報告
   - 段階的デプロイメント

## 結論

AI.mdの詳細な分析により、**提案1: TRPG Feature-based Testing Structure**が最も適切と確認できました。

### 選択理由：
1. **現在のアーキテクチャとの完全な整合性**
   - Feature-drivenアーキテクチャの維持
   - 既存のモック機能の活用
   - Discord OAuth認証の複雑さに対応

2. **TRPGアプリケーションの特性に最適化**
   - キャラクター管理、シナリオ管理等の機能別テスト
   - Discord API連携の専用テスト
   - ゲームシステム対応のテスト

3. **セキュリティ要件への対応**
   - 認証フローの包括的なテスト
   - JWT・トークン管理のテスト
   - 暗号化・復号化のテスト

4. **開発チームの生産性向上**
   - 機能開発とテスト開発の同期
   - 直感的なテスト配置
   - 段階的な導入が可能

### 実装の優先度：
1. **最優先**: 認証フローとセキュリティテスト
2. **高優先**: キャラクター管理の基本機能テスト
3. **中優先**: Discord連携とその他機能テスト
4. **低優先**: 統合・E2Eテスト

この構成により、現在「未実装」となっているテストを段階的に導入し、TRPGアプリケーションの品質と安全性を大幅に向上させることができます。