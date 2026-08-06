export function getDiscordAvatarUrl(userId: string, avatarHash?: string | null, size: number = 128): string {
  if (avatarHash) {
    return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png?size=${size}`
  }

  return getDefaultDiscordAvatarUrl(userId, size)
}

export function getDefaultDiscordAvatarUrl(userId: string, size: number = 128): string {
  const defaultAvatarIndex = (Number.parseInt(userId) >> 22) % 6
  return `https://cdn.discordapp.com/embed/avatars/${defaultAvatarIndex}.png?size=${size}`
}
