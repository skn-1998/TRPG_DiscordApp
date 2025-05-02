import { useLoaderData } from '@remix-run/react'
import { loader as parentLoader } from './_nest-route'
import { json, LoaderFunctionArgs } from '@remix-run/node'

export const loader = async ({ request, params, context }: LoaderFunctionArgs) => {
  const parentResponse = await parentLoader({ request, context, params })
  const parentJson = await parentResponse.json()
  const data = { ...parentJson, abc: 'abc' }
  return json(data)
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
