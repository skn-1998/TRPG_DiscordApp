'use client'

import { useActionState } from 'react'
import { Button, Stack, TextInput } from '@mantine/core'
import { submitActionTest } from './actions'

export default function ActionTestPage() {
  const [state, action, pending] = useActionState(submitActionTest, { message: '' })

  return (
    <form action={action}>
      <Stack>
        <p>action test</p>
        <TextInput name="message" defaultValue="Hello!" label="message" />
        <Button type="submit" loading={pending}>
          send
        </Button>
        {state.message && <p>Response: {state.message}</p>}
      </Stack>
    </form>
  )
}
