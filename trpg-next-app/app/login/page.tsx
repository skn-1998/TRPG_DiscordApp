import { redirect } from 'next/navigation'
import { LoginBtn } from '../features/auth/components/LoginBtn'

interface LoginPageProps {
  searchParams: Promise<{
    code?: string | string[]
    state?: string | string[]
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { code: codeParam, state: stateParam } = await searchParams
  const code = Array.isArray(codeParam) ? codeParam[0] : codeParam
  const state = Array.isArray(stateParam) ? stateParam[0] : stateParam

  if (code) {
    const callbackParams = new URLSearchParams({ code })
    if (state) {
      callbackParams.set('state', state)
    }
    redirect(`/auth/callback?${callbackParams.toString()}`)
  }

  return <LoginBtn authStartUrl="/auth/start" />
}
