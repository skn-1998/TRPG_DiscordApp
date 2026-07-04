'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, Container, Loader, Stack, Text } from '@mantine/core'

export function LoginCallback({ code }: { code: string }) {
  const router = useRouter()
  const started = useRef(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (started.current) return
    started.current = true

    const completeLogin = async () => {
      const response = await fetch('/auth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      })

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null
        setError(body?.message || 'Discord認証に失敗しました。')
        return
      }

      router.replace('/user')
      router.refresh()
    }

    completeLogin().catch(() => setError('Discord認証の処理中に通信エラーが発生しました。'))
  }, [code, router])

  return (
    <Container size="xs" mt={80}>
      {error ? (
        <Alert color="red" title="ログインできませんでした">
          {error}
        </Alert>
      ) : (
        <Stack align="center">
          <Loader color="accent" />
          <Text>Discord認証を完了しています...</Text>
        </Stack>
      )}
    </Container>
  )
}
