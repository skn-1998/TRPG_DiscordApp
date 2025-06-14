import { useLoaderData, useParams } from '@remix-run/react'
import { LoaderFunctionArgs, json } from '@remix-run/node'
import { requireLogin } from '../../utils/auth-guards'
import { Container, Title, Text, Card, Stack, Group, Badge, Button, Divider } from '@mantine/core'
import { IconUser, IconDice6, IconEdit, IconArrowLeft } from '@tabler/icons-react'
import { Link } from '@remix-run/react'

// 仮のキャラクターデータ型
interface Character {
  id: string
  name: string
  system: string
  level: number
  hitPoints: number
  magicPoints: number
  stats: {
    strength: number
    dexterity: number
    intelligence: number
    constitution: number
    appearance: number
    power: number
    size: number
    education: number
  }
  skills: Array<{
    name: string
    value: number
  }>
  description: string
  background: string
  ownerId: string
}

// 仮のキャラクターデータ（後でAPIから取得）
const getMockCharacter = (id: string): Character => ({
  id,
  name: `キャラクター${id}`,
  system: 'クトゥルフ神話TRPG',
  level: 1,
  hitPoints: 12,
  magicPoints: 8,
  stats: {
    strength: 60,
    dexterity: 70,
    intelligence: 80,
    constitution: 65,
    appearance: 55,
    power: 40,
    size: 60,
    education: 75
  },
  skills: [
    { name: '図書館', value: 75 },
    { name: '目星', value: 60 },
    { name: '聞き耳', value: 50 },
    { name: '心理学', value: 45 }
  ],
  description: 'これは仮のキャラクター説明です。',
  background: '古い本に囲まれた図書館で働く司書。',
  ownerId: 'user123'
})

export const loader = async (args: LoaderFunctionArgs) => {
  // 認証チェック
  await requireLogin(args)

  const { params } = args

  const { id } = params

  if (!id) {
    throw new Response('キャラクターIDが指定されていません', { status: 400 })
  }

  // TODO: 実際のAPIからキャラクターデータを取得
  // const character = await getCharacterById(id)
  const character = getMockCharacter(id)

  if (!character) {
    throw new Response('キャラクターが見つかりません', { status: 404 })
  }

  return json({ character })
}

export function ErrorBoundary() {
  return (
    <Container size="md" py="xl">
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack align="center" gap="md">
          <Title order={2} c="red">
            エラーが発生しました
          </Title>
          <Text>キャラクター情報の取得に失敗しました。</Text>
          <Button component={Link} to="/character" leftSection={<IconArrowLeft size={16} />}>
            キャラクター一覧に戻る
          </Button>
        </Stack>
      </Card>
    </Container>
  )
}

export default function CharacterDetail() {
  const { character } = useLoaderData<typeof loader>()
  const params = useParams()

  return (
    <Container size="md" py="xl">
      <Stack gap="xl">
        {/* ヘッダー */}
        <Group justify="space-between">
          <Button variant="subtle" component={Link} to="/character" leftSection={<IconArrowLeft size={16} />}>
            キャラクター一覧に戻る
          </Button>
          <Button component={Link} to={`/character/${params.id}/edit`} leftSection={<IconEdit size={16} />}>
            編集
          </Button>
        </Group>

        {/* キャラクター基本情報 */}
        <Card shadow="sm" padding="xl" radius="md" withBorder>
          <Stack gap="md">
            <Group align="center" gap="md">
              <IconUser size={40} />
              <div>
                <Title order={1}>{character.name}</Title>
                <Group gap="xs" mt="xs">
                  <Badge variant="light" color="blue">
                    {character.system}
                  </Badge>
                  <Badge variant="light" color="green">
                    Lv.{character.level}
                  </Badge>
                </Group>
              </div>
            </Group>

            <Divider />

            <Group grow>
              <Stack align="center" gap="xs">
                <Text size="sm" c="dimmed">
                  HP
                </Text>
                <Title order={3} c="red">
                  {character.hitPoints}
                </Title>
              </Stack>
              <Stack align="center" gap="xs">
                <Text size="sm" c="dimmed">
                  MP
                </Text>
                <Title order={3} c="blue">
                  {character.magicPoints}
                </Title>
              </Stack>
            </Group>
          </Stack>
        </Card>

        {/* 能力値 */}
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="md">
            <Group align="center" gap="xs">
              <IconDice6 size={24} />
              <Title order={3}>能力値</Title>
            </Group>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '16px' }}>
              {Object.entries(character.stats).map(([key, value]) => {
                const statNames: Record<string, string> = {
                  strength: 'STR',
                  dexterity: 'DEX',
                  intelligence: 'INT',
                  constitution: 'CON',
                  appearance: 'APP',
                  power: 'POW',
                  size: 'SIZ',
                  education: 'EDU'
                }

                return (
                  <Card key={key} shadow="xs" padding="sm" radius="sm" withBorder>
                    <Stack align="center" gap="xs">
                      <Text size="sm" fw={500}>
                        {statNames[key]}
                      </Text>
                      <Title order={4}>{value}</Title>
                    </Stack>
                  </Card>
                )
              })}
            </div>
          </Stack>
        </Card>

        {/* 技能 */}
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="md">
            <Title order={3}>技能</Title>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              {character.skills.map((skill, index) => (
                <Group
                  key={index}
                  justify="space-between"
                  p="sm"
                  style={{
                    backgroundColor: 'var(--mantine-color-gray-0)',
                    borderRadius: '4px'
                  }}
                >
                  <Text>{skill.name}</Text>
                  <Badge variant="filled" color="teal">
                    {skill.value}
                  </Badge>
                </Group>
              ))}
            </div>
          </Stack>
        </Card>

        {/* 背景・説明 */}
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="md">
            <Title order={3}>キャラクター詳細</Title>

            <div>
              <Text fw={500} mb="xs">
                背景
              </Text>
              <Text>{character.background}</Text>
            </div>

            <div>
              <Text fw={500} mb="xs">
                説明
              </Text>
              <Text>{character.description}</Text>
            </div>
          </Stack>
        </Card>
      </Stack>
    </Container>
  )
}
