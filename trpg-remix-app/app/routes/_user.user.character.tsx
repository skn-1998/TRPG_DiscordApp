import { Link, Outlet, useOutletContext } from '@remix-run/react'

export default function User() {
  // 親ルート(User.tsx)の loader が返す型情報を取得
  const outletContextData = useOutletContext<{ data: unknown; cookie: string }>()

  return (
    <>
      <div>
        <div>このページはオミット 移行先↓</div>
        <Link to="/character">character</Link>
      </div>
      <div>characterPage</div>
      <div>data: {JSON.stringify(outletContextData.data)}</div>
      <div>cookie: {outletContextData.cookie}</div>
      <Outlet context={outletContextData} />
    </>
  )
}
