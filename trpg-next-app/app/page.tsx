import { HomeContent } from './components/HomeContent'
import { getAuthState } from './lib/auth-state.server'

export default async function Home() {
  const authState = await getAuthState()

  return <HomeContent authState={authState} />
}
