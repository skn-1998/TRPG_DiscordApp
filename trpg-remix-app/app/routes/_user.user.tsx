import { Outlet, useLoaderData } from '@remix-run/react'
import { validateJwt } from '../features/auth/api/auth.service'
import { LoaderFunctionArgs, redirect } from '@remix-run/node'
import { CustomError } from '../utils/customError'

export const loader = async (args: LoaderFunctionArgs) => {
  try {
    // validateJwtはJWTが無効な場合、自動的に/loginにリダイレクトします
    const data = await validateJwt(args)

    // validateJwtがredirectを返した場合（認証失敗）、そのまま返す
    if (data && typeof data === 'object' && 'status' in data) {
      return data
    }

    const cookie = args.request.headers.get('Cookie') || ''
    return { data, cookie }
  } catch (error) {
    console.error('User page loader error:', CustomError(error))
    // エラーが発生した場合もログインページにリダイレクト
    return redirect('/login')
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
