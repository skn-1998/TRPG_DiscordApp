import { Link, Outlet, useOutletContext } from '@remix-run/react'
import { CharacterCreate } from '~/features/character'

export default function User() {
  // 親ルート(User.tsx)の loader が返す型情報を取得
  const outletContextData = useOutletContext<{ data: unknown; cookie: string }>()

  return (
    <>
      <CharacterCreate />
    </>
  )
}
