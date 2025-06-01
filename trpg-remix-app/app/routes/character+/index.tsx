import { Outlet } from '@remix-run/react'

export default function Character() {
  return (
    <div>
      character
      <Outlet />
    </div>
  )
}
