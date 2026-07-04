'use client'

import Link from 'next/link'
import { Badge, Button, Card, Container, Group, Stack, Text, Title } from '@mantine/core'
import { IconEdit, IconEye, IconUser } from '@tabler/icons-react'
import { CharacterCreate } from '~/features/character'

const mockCharacters = [
  { id: '1', name: '探偵 田中', system: 'クトゥルフ神話TRPG', level: 3, lastPlayed: '2024-01-15' },
  { id: '2', name: '魔法使い 佐藤', system: 'ソード・ワールド2.5', level: 5, lastPlayed: '2024-01-12' },
  { id: '3', name: '戦士 鈴木', system: 'ダンジョンズ&ドラゴンズ 5版', level: 2, lastPlayed: '2024-01-10' }
]

export default function CharacterPage() {
  return (
    <Container size="md" py="xl">
      <Stack gap="xl">
        <div>
          <Title order={1} mb="md">
            キャラクター管理
          </Title>
          <Text c="dimmed">あなたのTRPGキャラクターを作成・管理できます</Text>
        </div>

        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Title order={2} mb="md">
            新しいキャラクターを作成
          </Title>
          <CharacterCreate />
        </Card>

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
                      <Badge variant="light">{character.system}</Badge>
                      <Badge variant="light" color="green">
                        Lv.{character.level}
                      </Badge>
                    </Group>
                  </div>
                </Group>
                <Group gap="sm">
                  <Button
                    variant="light"
                    component={Link}
                    href={`/character/${character.id}`}
                    leftSection={<IconEye size={16} />}
                  >
                    詳細
                  </Button>
                  <Button
                    variant="outline"
                    component={Link}
                    href={`/character/${character.id}/edit`}
                    leftSection={<IconEdit size={16} />}
                  >
                    編集
                  </Button>
                </Group>
              </Group>
            </Card>
          ))}
        </Stack>
      </Stack>
    </Container>
  )
}
