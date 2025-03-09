import { Character } from '../features/character'
import { Outlet, useOutletContext } from '@remix-run/react'
import type { loader as parentLoader } from './_user.user'


export default function User() {
  // 親ルート(User.tsx)の loader が返す型情報を取得
  const data = useOutletContext<ReturnType<typeof parentLoader>>()

  return (<>
    <div>characterPage</div>
    <div>data: {JSON.stringify(data)}</div>
    <Character />
    <Outlet />
  </>)
}
