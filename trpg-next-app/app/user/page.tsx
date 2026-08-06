import { requireJwt } from '../lib/auth-guard.server'

export default async function UserPage() {
  await requireJwt()

  return <main>ユーザーページは N3 で置換予定です。</main>
}
