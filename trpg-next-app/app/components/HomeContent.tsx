'use client'

import Link from 'next/link'
import { Button, Card, Container, Group, Stack, Text, Title } from '@mantine/core'
import { IconBook, IconDice6, IconUsers } from '@tabler/icons-react'
import type { AuthState } from '../lib/auth-state.server'

interface HomeContentProps {
  authState: AuthState
}

export function HomeContent({ authState }: HomeContentProps) {
  const { user, isLoggedIn } = authState

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
                  <Button component={Link} href="/scenario" variant="light" fullWidth>
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
              TRPG Masterは、オンラインでのテーブルトークRPGセッションを 簡単に管理できるプラットフォームです。
              キャラクター作成からシナリオ管理まで、すべてを一つの場所で。
            </Text>

            <Group gap="md" mt="xl">
              <Button size="lg" component={Link} href="/login">
                ログインして始める
              </Button>
              <Button variant="outline" size="lg" component={Link} href="/about">
                詳細を見る
              </Button>
            </Group>
          </Stack>
        )}

        <Stack gap="md" mt="xl">
          <Title order={3} ta="center">
            主な機能
          </Title>
          <Group grow>
            <Card shadow="sm" padding="md" radius="md" withBorder>
              <Text fw={500} ta="center">
                キャラクター管理
              </Text>
              <Text size="sm" c="dimmed" ta="center" mt="xs">
                RPGキャラクターの作成・編集・管理
              </Text>
            </Card>

            <Card shadow="sm" padding="md" radius="md" withBorder>
              <Text fw={500} ta="center">
                シナリオ管理
              </Text>
              <Text size="sm" c="dimmed" ta="center" mt="xs">
                TRPGシナリオの作成・共有・実行
              </Text>
            </Card>

            <Card shadow="sm" padding="md" radius="md" withBorder>
              <Text fw={500} ta="center">
                セッション管理
              </Text>
              <Text size="sm" c="dimmed" ta="center" mt="xs">
                オンラインセッションの進行サポート
              </Text>
            </Card>
          </Group>
        </Stack>
      </Stack>
    </Container>
  )
}
