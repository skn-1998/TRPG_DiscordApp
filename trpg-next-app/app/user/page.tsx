import { requireJwt } from '../lib/auth-guard.server'

export default async function UserPage() {
  await requireJwt()

  return <div />
}
