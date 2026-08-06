import 'server-only'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export const JWT_COOKIE_NAME = 'jwt'

export async function readJwt(): Promise<string | undefined> {
  return (await cookies()).get(JWT_COOKIE_NAME)?.value
}

/**
 * Next の layout は soft navigation で再実行されず、親 layout の gate は子 page を守れない。
 * 保護 page / Server Action は処理の先頭で明示的に呼ぶ（旧 #72 規約の Next 版）。
 */
export async function requireJwt(): Promise<void> {
  if (!(await readJwt())) {
    redirect('/login')
  }
}
