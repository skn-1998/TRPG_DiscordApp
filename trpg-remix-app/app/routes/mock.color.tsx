import { Outlet } from '@remix-run/react'
import { ColorSample } from '~/features/mock'

export default function MockColor() {
  return (
    <>
      <ColorSample />
      <Outlet />
    </>
  )
}
