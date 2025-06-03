import { Outlet, useLoaderData } from '@remix-run/react'
import { validateJwt } from '~/features/auth'
import { LoaderFunctionArgs, redirect } from '@remix-run/node'
import { CustomError } from '~/utils/customError'

// export const loader = validateJwtLoader
export const loader = async (args: LoaderFunctionArgs) => {
  const data = await validateJwt(args)
  try {
    const cookie = args.request.headers.get('Cookie') || ''
    return { data, cookie }
  } catch (error) {
    CustomError(error)
  }
}

export default function User() {
  // 親ルートの loader から取得したデータ
  const loaderData = useLoaderData<typeof loader>()

  return (
    <div>
      <Outlet context={loaderData} />
      userPage
    </div>
  )
}
