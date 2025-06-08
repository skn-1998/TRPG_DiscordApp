/**
 * DiscordのアバターURLを生成する関数
 * @param userId DiscordユーザーID
 * @param avatarHash アバターハッシュ（nullableの場合はデフォルトアバターを使用）
 * @param size アバター画像のサイズ（デフォルト: 128）
 * @returns アバター画像のURL
 */
export function getDiscordAvatarUrl(userId: string, avatarHash?: string | null, size: number = 128): string {
  if (avatarHash) {
    // カスタムアバターがある場合
    return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png?size=${size}`
  } else {
    // デフォルトアバターを使用
    const defaultAvatarIndex = (parseInt(userId) >> 22) % 6
    return `https://cdn.discordapp.com/embed/avatars/${defaultAvatarIndex}.png?size=${size}`
  }
}

/**
 * アバター画像の読み込みエラー時のフォールバック処理
 * @param userId DiscordユーザーID
 * @param size アバター画像のサイズ
 * @returns デフォルトアバターのURL
 */
export function getDefaultDiscordAvatarUrl(userId: string, size: number = 128): string {
  const defaultAvatarIndex = (parseInt(userId) >> 22) % 6
  return `https://cdn.discordapp.com/embed/avatars/${defaultAvatarIndex}.png?size=${size}`
}
