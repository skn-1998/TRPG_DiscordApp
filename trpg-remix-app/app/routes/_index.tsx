import type { MetaFunction } from '@remix-run/node'
import { Link } from '@remix-run/react'
import { useAuth } from '../hooks/useAuth'
import { Button, Container, Title, Text, Stack, Group, Card } from '@mantine/core'
import { IconDice6, IconUsers, IconBook } from '@tabler/icons-react'

export const meta: MetaFunction = () => {
  return [{ title: 'New Remix App' }, { name: 'description', content: 'Welcome to Remix!' }]
}

export default function Index() {
  // Root Loaderから認証状態を取得（認証は必須ではない）
  const { user, isLoggedIn, isLoading } = useAuth()

  if (isLoading) {
    return (
      <Container size="md" py="xl">
        <Text>読み込み中...</Text>
      </Container>
    )
  }

  return (
    <Container size="md" py="xl">
      <Stack gap="xl">
        {/* ヘッダー部分 */}
        <div style={{ textAlign: 'center' }}>
          <IconDice6 size={64} />
          <Title order={1} mt="md">
            TRPG Master
          </Title>
          <Text size="lg" c="dimmed" mt="sm">
            オンラインTRPGセッションを簡単に管理
          </Text>
        </div>

        {/* 認証状態によって異なる表示 */}
        {isLoggedIn && user ? (
          // ログイン済みユーザー向けの表示
          <Stack gap="md">
            <Title order={2}>おかえりなさい、{user.name}さん！</Title>
            <Group grow>
              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Stack align="center" gap="sm">
                  <IconUsers size={32} />
                  <Text fw={500}>キャラクター管理</Text>
                  <Button component={Link} to="/character" variant="light" fullWidth>
                    キャラクターを見る
                  </Button>
                </Stack>
              </Card>

              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Stack align="center" gap="sm">
                  <IconBook size={32} />
                  <Text fw={500}>シナリオ管理</Text>
                  <Button component={Link} to="/scenario" variant="light" fullWidth>
                    シナリオを見る
                  </Button>
                </Stack>
              </Card>
            </Group>

            <Button component={Link} to="/user" size="lg" fullWidth>
              ユーザーページへ
            </Button>
          </Stack>
        ) : (
          // 未ログインユーザー向けの表示
          <Stack gap="md" align="center">
            <Title order={2}>TRPGセッションを始めよう</Title>
            <Text ta="center" maw={600}>
              TRPG Masterは、オンラインでのテーブルトークRPGセッションを 簡単に管理できるプラットフォームです。
              キャラクター作成からシナリオ管理まで、すべてを一つの場所で。
            </Text>

            <Group gap="md" mt="xl">
              <Button size="lg" component={Link} to="/login">
                ログインして始める
              </Button>
              <Button variant="outline" size="lg" component={Link} to="/about">
                詳細を見る
              </Button>
            </Group>
          </Stack>
        )}

        {/* 共通の機能紹介 */}
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
