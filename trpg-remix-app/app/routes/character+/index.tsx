import { Outlet, Link } from '@remix-run/react'
import { Container, Title, Stack, Card, Group, Text, Badge, Button } from '@mantine/core'
import { IconUser, IconEdit, IconEye } from '@tabler/icons-react'
import { CharacterCreate } from '~/features/character'
import { action as _action } from '~/features/character'

export const action = _action

// 仮のキャラクターリスト
const mockCharacters = [
  {
    id: '1',
    name: '探偵 田中',
    system: 'クトゥルフ神話TRPG',
    level: 3,
    lastPlayed: '2024-01-15'
  },
  {
    id: '2',
    name: '魔法使い 佐藤',
    system: 'ソード・ワールド2.5',
    level: 5,
    lastPlayed: '2024-01-12'
  },
  {
    id: '3',
    name: '戦士 鈴木',
    system: 'ダンジョンズ&ドラゴンズ 5版',
    level: 2,
    lastPlayed: '2024-01-10'
  }
]

export default function Character() {
  return (
    <Container size="md" py="xl">
      <Stack gap="xl">
        <div>
          <Title order={1} mb="md">
            キャラクター管理
          </Title>
          <Text c="dimmed">あなたのTRPGキャラクターを作成・管理できます</Text>
        </div>

        {/* キャラクター作成フォーム */}
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Title order={2} mb="md">
            新しいキャラクターを作成
          </Title>
          <CharacterCreate />
        </Card>

        {/* キャラクター一覧 */}
        <div>
          <Title order={2} mb="md">
            あなたのキャラクター
          </Title>
          <Stack gap="md">
            {mockCharacters.map((character) => (
              <Card key={character.id} shadow="sm" padding="lg" radius="md" withBorder>
                <Group justify="space-between" align="center">
                  <Group align="center" gap="md">
                    <IconUser size={32} />
                    <div>
                      <Text fw={500} size="lg">
                        {character.name}
                      </Text>
                      <Group gap="xs" mt="xs">
                        <Badge variant="light" color="blue">
                          {character.system}
                        </Badge>
                        <Badge variant="light" color="green">
                          Lv.{character.level}
                        </Badge>
                        <Text size="sm" c="dimmed">
                          最終プレイ: {character.lastPlayed}
                        </Text>
                      </Group>
                    </div>
                  </Group>

                  <Group gap="sm">
                    <Button
                      variant="light"
                      component={Link}
                      to={`/character/${character.id}`}
                      leftSection={<IconEye size={16} />}
                    >
                      詳細
                    </Button>
                    <Button
                      variant="outline"
                      component={Link}
                      to={`/character/${character.id}/edit`}
                      leftSection={<IconEdit size={16} />}
                    >
                      編集
                    </Button>
                  </Group>
                </Group>
              </Card>
            ))}

            {mockCharacters.length === 0 && (
              <Card shadow="sm" padding="xl" radius="md" withBorder>
                <Stack align="center" gap="md">
                  <IconUser size={48} stroke={1} />
                  <div style={{ textAlign: 'center' }}>
                    <Text fw={500} mb="xs">
                      キャラクターがありません
                    </Text>
                    <Text size="sm" c="dimmed">
                      上のフォームから新しいキャラクターを作成してください
                    </Text>
                  </div>
                </Stack>
              </Card>
            )}
          </Stack>
        </div>

        <Outlet />
      </Stack>
    </Container>
  )
}
