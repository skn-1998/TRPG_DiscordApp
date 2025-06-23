import { useLoaderData } from '@remix-run/react'
import { loader as parentLoader } from './_nest-route'
import { LoaderFunctionArgs } from '@remix-run/node'

export const loader = async ({ request, params, context }: LoaderFunctionArgs) => {
  const parentResponse = await parentLoader({ request, context, params })
  // Single Fetchを使用している場合は、Responseオブジェクト形式で返ってこない
  const data = { ...parentResponse, abc: 'abc' }
  return data
}

export default function NestedRouteChild() {
  const loaderData = useLoaderData<typeof loader>()
  console.log(loaderData)

  return (
    <>
      <div>nested route child</div>
    </>
  )
}
