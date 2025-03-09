import { useLoaderData } from '@remix-run/react'
import { loader } from '../../../routes/_auth.login'

export function LoginBtn() {
  const { discordAuthUrl } = useLoaderData<typeof loader>()

  return (
    <>
      <div>
        <a href={discordAuthUrl} target="_blank" rel="noreferrer">
          <button>Login with Discord</button>
        </a>
      </div>
    </>
  )
}
