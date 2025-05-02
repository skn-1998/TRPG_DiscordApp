import { json, LoaderFunctionArgs } from '@remix-run/node'
import { Outlet } from '@remix-run/react'

export const loader = async (args: LoaderFunctionArgs) => {
  const { params, request, context } = args
  return json({ hoge: 'hoge' })
}

export default function NestedRoute() {
  return (
    <>
      nested route test
      <Outlet />
    </>
  )
}
