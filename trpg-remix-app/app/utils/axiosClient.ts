/**
 * 🗑️ このファイルは完全に非推奨になりました
 *
 * ✅ 移行完了: すべての使用箇所が新しいアーキテクチャに移行されました
 *
 * 新しい使用方法:
 * - API通信: ~/lib/api-client.ts
 * - 認証: ~/features/auth
 * - キャラクター: ~/features/character
 * - ユーザー: ~/features/users
 * - 型定義: ~/lib/types.ts
 *
 * このファイルは安全に削除できます。
 */

// 後方互換性のための一時的な再エクスポート（まもなく削除予定）
export { apiClient as axiosInstance } from '~/lib/api-client'
export { loginOrRegisterUser, validateJwt } from '~/features/auth'
export type { User as TRPGUser } from '~/types'

console.warn('⚠️ utils/axiosClient.ts は非推奨です。新しいfeature-based architectureを使用してください。')
