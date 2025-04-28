import { Outlet } from '@remix-run/react'
import { ScrollTest } from '~/features/mock'

export default function MockScrollTest() {
  return (
    <>
      <ScrollTest />
      <Outlet />
    </>
  )
}
