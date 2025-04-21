import { Outlet } from '@remix-run/react'
import { MockButton, ColorSample } from '~/features/mock'

export default function MockIndex() {
  return (
    <>
      <MockButton />
      <ColorSample />
      <Outlet />
    </>
  )
}
