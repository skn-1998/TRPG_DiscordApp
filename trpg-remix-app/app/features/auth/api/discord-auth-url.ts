interface DiscordAuthUrlOptions {
  applicationId: string
  hostDomain: string
}

export function generateDiscordAuthUrl({ applicationId, hostDomain }: DiscordAuthUrlOptions): string {
  const normalizedHost = hostDomain.replace(/\/+$/, '')
  const params = new URLSearchParams({
    client_id: applicationId,
    response_type: 'code',
    redirect_uri: `${normalizedHost}/login`,
    scope: 'identify email guilds'
  })

  return `https://discord.com/oauth2/authorize?${params.toString()}`
}
