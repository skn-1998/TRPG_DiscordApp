import 'server-only'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

/** 保護 page は処理の先頭で明示的に呼ぶ。 */
export async function requireJwt(): Promise<string> {
  const jwt = (await cookies()).get('jwt')?.value
  if (!jwt) {
    redirect('/login')
  }

  return jwt
}
