import { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node'
import { useActionData, useLoaderData, useFetcher } from '@remix-run/react'
import { Button } from '@mantine/core'
import { CustomError } from '~/utils/customError'
import axios from 'axios'

export const loader = async ({ request, params, context }: LoaderFunctionArgs) => {
  // console.log('--- request start ---')
  // console.log(request)
  // console.log('--- request end ---')
  // console.log('--- params start ---')
  // console.log(params)
  // console.log('--- params end ---')
  // console.log('--- context start ---')
  // console.log(context)
  // console.log('--- context end ---')

  return { red: 'aka' }
}

export async function action(args: ActionFunctionArgs) {
  // console.log('action')
  const { request, context, params } = args
  // console.log('--- request start ---')
  // console.log(request)
  // console.log('--- request end ---')
  // console.log('--- params start ---')
  // console.log(params)
  // console.log('--- params end ---')
  // console.log('--- context start ---')
  // console.log(context)
  // console.log('--- context end ---')

  try {
    const body = await request.formData()
    console.log(...body.entries())
  } catch (error) {
    console.log(CustomError(error))
  }

  return { test: 'this is test data.' }
}

export default function ActionTest() {
  const fetcher = useFetcher<typeof action>()
  const data = useActionData<typeof action>()
  const _data = useLoaderData<typeof loader>()
  // console.log('--- _data ---')
  // console.log(_data)
  // console.log('--- _data end ---')

  const handleClick = async () => {
    console.log('click')
    const formData = new FormData()
    formData.append('coffee', '123456789!')
    const res = await axios.post('/action-test', formData)
    console.log(res)
  }

  function handleSubmit() {
    console.log('submit')
    const formData = new FormData()
    formData.append('message', 'Hello!')
    fetcher.submit(formData, { method: 'post', action: '/action-test' })
  }

  return (
    <>
      <p>action test</p>
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
