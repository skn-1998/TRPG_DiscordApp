import { redirect } from 'next/navigation'
import { generateDiscordAuthUrl } from '../features/auth/api/auth.service.server'
import { LoginBtn } from '../features/auth/components/LoginBtn'

interface LoginPageProps {
  searchParams: Promise<{
    code?: string | string[]
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const codeParam = (await searchParams).code
  const code = Array.isArray(codeParam) ? codeParam[0] : codeParam

  if (code) {
    const callbackParams = new URLSearchParams({ code })
    redirect(`/auth/callback?${callbackParams.toString()}`)
  }

  return <LoginBtn discordAuthUrl={generateDiscordAuthUrl()} />
}
