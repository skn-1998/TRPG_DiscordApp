import type { Metadata } from 'next'
import { LoginBtn } from '~/features/auth'
import { LoginCallback } from '~/features/auth/components/LoginCallback'
import { generateDiscordAuthUrl } from '~/features/auth/api/discord-auth-url'

export const metadata: Metadata = {
  title: 'ログイン'
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams

  if (code) {
    return <LoginCallback code={code} />
  }

  return (
    <LoginBtn
      discordAuthUrl={generateDiscordAuthUrl({
        applicationId: process.env.DISCORD_APPLICATIONID || '',
        hostDomain: process.env.HOST_DOMAIN || 'http://127.0.0.1:5173'
      })}
    />
  )
}
