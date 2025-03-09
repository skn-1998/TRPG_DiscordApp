import { Outlet, useLoaderData } from '@remix-run/react'
import { validateJWTLoader } from '~/utils/axiosClient'
import { LoaderFunctionArgs } from '@remix-run/node'

// export const loader = validateJWTLoader
export const loader = async (args: LoaderFunctionArgs) => {
  const data = await validateJWTLoader(args)
  return data
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
