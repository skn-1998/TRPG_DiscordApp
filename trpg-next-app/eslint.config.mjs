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
            }
          ]
        }
      ]
    }
  },
  globalIgnores(['.next/**', 'coverage/**', 'next-env.d.ts'])
])
