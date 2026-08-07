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
                'CharacterSummaryWire',
                'CharacterWire',
                'CreateCharacterFromTemplateResultWire',
                'DicePreviewRequest',
                'DicePreviewResponse',
                'DiscordGuildWire',
                'DiscordGuildsPayloadWire',
                'SaveCharacterSheetResultWire',
                'UserProfileWire',
                'dicePreviewRequestSchema',
                'dicePreviewResponseSchema'
              ],
              message: '永続化スキーマは front で使用禁止。公開済み wire 型と dice preview 契約だけを使用する'
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
            // 許可する feature 間の有向辺: character→characterTemplate / characterTemplate→character / character→discord。
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
              except: ['./character', './characterTemplate', './discord'],
              message:
                'feature 間の直接依存は宣言済みの辺のみ（許可辺の正本は AI.md）。共有ロジックは app/lib へ（#121）'
            },
            {
              target: './app/features/characterTemplate',
              from: './app/features',
              except: ['./characterTemplate', './character'],
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
