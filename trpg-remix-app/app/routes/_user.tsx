import { Outlet } from '@remix-run/react'
import { UserPageNav } from '../features/users'

export default function User() {
  return (
    <div color="#ffffff">
      <UserPageNav />
      <Outlet />
    </div>
  )
}
