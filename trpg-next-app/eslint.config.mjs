import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@trpg/api-contract',
              allowImportNames: [
                'SuccessEnvelope',
                'ErrorEnvelope',
                'LoginDataWire',
                'CharacterDeleteResultWire',
                'CharacterHubStatusWire',
                'CharacterSheetVisibility',
                'CharacterSummaryWire',
                'CharacterWire',
                'CreateCharacterFromTemplateResultWire',
                'DicePreviewRequest',
                'DicePreviewResponse',
                'DiscordGuildWire',
                'DiscordGuildsPayloadWire',
                'RollOnCreateResultWire',
                'SaveCharacterSheetResultWire',
                'SheetMergeConflictWire',
                'UserProfileWire',
                'dicePreviewRequestSchema',
                'dicePreviewResponseSchema',
                'sheetMergeConflictSchema'
              ],
              message:
                '永続化スキーマは front で使用禁止。公開済み wire 型・dice preview 契約・sheet merge conflict 契約だけを使用する'
            }
          ],
          patterns: [
            {
              group: ['@trpg/api-contract/*'],
              message: '契約パッケージはルートからのみ import する'
            }
          ]
        }
      ],
      'import/no-restricted-paths': [
        'error',
        {
          basePath: import.meta.dirname,
          zones: [
            {
              target: './app/lib',
              from: './app/features',
              message: 'lib 層は features に依存しない（層規約・server #31 の front 版）'
            },
            // 以下 6 zone は feature 間依存を宣言辺のみに固定する列挙（新 feature 追加時は zone を 1 本足す）。
            // 許可辺は except に現れる 5 本だけ: character→characterTemplate / characterTemplate→character / character→discord / characterTemplate→characterSheet / character→characterSheet。
            {
              target: './app/features/auth',
              from: './app/features',
              except: ['./auth'],
              message:
                'feature 間の直接依存は宣言済みの辺のみ（許可辺の正本は AI.md）。共有ロジックは app/lib へ（#121）'
            },
            {
              target: './app/features/users',
              from: './app/features',
              except: ['./users'],
              message:
                'feature 間の直接依存は宣言済みの辺のみ（許可辺の正本は AI.md）。共有ロジックは app/lib へ（#121）'
            },
            {
              target: './app/features/discord',
              from: './app/features',
              except: ['./discord'],
              message:
                'feature 間の直接依存は宣言済みの辺のみ（許可辺の正本は AI.md）。共有ロジックは app/lib へ（#121）'
            },
            {
              target: './app/features/character',
              from: './app/features',
              except: ['./character', './characterTemplate', './discord', './characterSheet'],
              message:
                'feature 間の直接依存は宣言済みの辺のみ（許可辺の正本は AI.md）。共有ロジックは app/lib へ（#121）'
            },
            {
              target: './app/features/characterTemplate',
              from: './app/features',
              except: ['./characterTemplate', './character', './characterSheet'],
              message:
                'feature 間の直接依存は宣言済みの辺のみ（許可辺の正本は AI.md）。共有ロジックは app/lib へ（#121）'
            },
            {
              target: './app/features/characterSheet',
              from: './app/features',
              except: ['./characterSheet'],
              message:
                'feature 間の直接依存は宣言済みの辺のみ（許可辺の正本は AI.md）。共有ロジックは app/lib へ（#121）'
            }
          ]
        }
      ]
    }
  },
  globalIgnores(['.next/**', 'coverage/**', 'next-env.d.ts'])
])
