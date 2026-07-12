import { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node'
import { loader as parentLoader } from './_nest-route'
import { useActionData, useLoaderData, useFetcher } from '@remix-run/react'
import { corsApiWithJwt } from '~/utils/corsApiWithJwt'
import { Button } from '@mantine/core'
import { CustomError } from '~/utils/customError'
import axios from 'axios'

export const loader = async ({ request, params, context }: LoaderFunctionArgs) => {
  const parentResponse = await parentLoader({ request, context, params })
  // Single Fetchを使用している場合は、Responseオブジェクト形式で返ってこない
  const data = { ...parentResponse, foo: 'foo' }
  return data
}

export async function action(args: ActionFunctionArgs) {
  console.log('action')
  const { request, context, params } = args

  try {
    const body = await request.formData()
    console.log(...body.entries())
  } catch (error) {
    console.log(CustomError(error))
  }

  const result = await corsApiWithJwt(args, { method: 'GET', endpoint: '/character' })
  console.log(result)

  return { test: 'this is test data.' }
}

export default function NestedRouteAction() {
  const fetcher = useFetcher<typeof action>()
  const data = useActionData<typeof action>()
  const _data = useLoaderData<typeof loader>()
  console.log(_data)

  const handleClick = async () => {
    console.log('click')
    const formData = new FormData()
    formData.append('fuga', 'fuga')
    const res = await axios.post('/action', formData)
    console.log(res)
  }

  function handleSubmit() {
    console.log('submit')
    const formData = new FormData()
    formData.append('message', 'Hello!')
    fetcher.submit(formData, { method: 'post', action: '/action' })
  }

  return (
    <>
      nested route action
      <Button onClick={handleClick}>push</Button>
      <Button onClick={handleSubmit}>send</Button>
      <p>{data && <div>{JSON.stringify(data)}</div>}</p>
      <div>
        {fetcher.state === 'submitting' && <p>Sending...</p>}
        {fetcher.data && <p>Response: {JSON.stringify(fetcher.data)}</p>}
      </div>
    </>
  )
}
