'use client'

import Link from 'next/link'
import { Button, Card, Container, Group, Stack, Text, Title } from '@mantine/core'
import { IconBook, IconDice6, IconUsers } from '@tabler/icons-react'
import { useAuth } from './hooks/useAuth'

export function HomePage() {
  const { user, isLoggedIn } = useAuth()

  return (
    <Container size="md" py="xl">
      <Stack gap="xl">
        <div style={{ textAlign: 'center' }}>
          <IconDice6 size={64} />
          <Title order={1} mt="md">
            TRPG Master
          </Title>
          <Text size="lg" c="dimmed" mt="sm">
            オンラインTRPGセッションを簡単に管理
          </Text>
        </div>

        {isLoggedIn && user ? (
          <Stack gap="md">
            <Title order={2}>おかえりなさい、{user.name}さん！</Title>
            <Group grow>
              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Stack align="center" gap="sm">
                  <IconUsers size={32} />
                  <Text fw={500}>キャラクター管理</Text>
                  <Button component={Link} href="/character" variant="light" fullWidth>
                    キャラクターを見る
                  </Button>
                </Stack>
              </Card>
              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Stack align="center" gap="sm">
                  <IconBook size={32} />
                  <Text fw={500}>シナリオ管理</Text>
                  <Button component={Link} href="/user/story" variant="light" fullWidth>
                    シナリオを見る
                  </Button>
                </Stack>
              </Card>
            </Group>
            <Button component={Link} href="/user" size="lg" fullWidth>
              ユーザーページへ
            </Button>
          </Stack>
        ) : (
          <Stack gap="md" align="center">
            <Title order={2}>TRPGセッションを始めよう</Title>
            <Text ta="center" maw={600}>
              TRPG Masterは、キャラクター作成からシナリオ管理までオンラインセッションを支援します。
            </Text>
            <Button size="lg" component={Link} href="/login">
              ログインして始める
            </Button>
          </Stack>
        )}

        <Stack gap="md" mt="xl">
          <Title order={3} ta="center">
            主な機能
          </Title>
          <Group grow>
            {['キャラクター管理', 'シナリオ管理', 'セッション管理'].map((label) => (
              <Card key={label} shadow="sm" padding="md" radius="md" withBorder>
                <Text fw={500} ta="center">
                  {label}
                </Text>
              </Card>
            ))}
          </Group>
        </Stack>
      </Stack>
    </Container>
  )
}
