import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { serverApiRequest } from '~/lib/server-api'

export async function POST() {
  try {
    await serverApiRequest('/auth/logout', { method: 'POST' })
  } catch {
    // ローカルCookieはバックエンド応答にかかわらず破棄する。
  }

  const cookieStore = await cookies()
  cookieStore.delete('jwt')

  return NextResponse.json({ success: true })
}
