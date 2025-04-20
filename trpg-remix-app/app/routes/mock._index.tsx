import { Outlet } from '@remix-run/react'
import { MockButton } from '~/features/mock'

export default function MockIndex() {
  return (
    <>
      <MockButton />
      <Outlet />
    </>
  )
}
