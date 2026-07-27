import type { UserProfileWire } from '@trpg/api-contract'

/**
 * ユーザー関連の型定義
 */

/**
 * UserController GET /users の presenter 直列化形。
 */
// S5a で契約化済み。server 側戻り型も S5a2 で機械固定済み。
export type UserProfileData = UserProfileWire
