import { Outlet } from '@remix-run/react'
import { HeaderMenu } from '../components/Elements/HeaderMenu'

export default function HeaderTest() {
  return (
    <>
      <div>
        <HeaderMenu />
      </div>
      <Outlet />
    </>
  )
}
