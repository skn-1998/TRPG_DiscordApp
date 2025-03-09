import { Outlet } from '@remix-run/react'
import { loginLoader, LoginBtn } from '../features/auth'

export const loader = loginLoader

export default function Login() {
  return (
    <>
      <LoginBtn />
      <Outlet />
    </>
  )
}
