import { Character } from '../features/character'
import { Outlet, useOutletContext } from '@remix-run/react'


export default function User() {
  // 親ルート(User.tsx)の loader が返す型情報を取得
  const outletContextData = useOutletContext<{ data: any, cookie: string }>()

  return (<>
    <div>characterPage</div>
    <div>data: {JSON.stringify(outletContextData.data)}</div>
    <div>cookie: {outletContextData.cookie}</div>
    <Outlet context={outletContextData} />
    <Character />
  </>)
}
