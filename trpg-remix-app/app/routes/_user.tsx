import { Outlet } from '@remix-run/react'
import { UserPageNav } from '../features/users'

export default function User() {
  return (
    <div>
      {/* <UserPageNav /> */}
      <Outlet />
    </div>
  )
}
