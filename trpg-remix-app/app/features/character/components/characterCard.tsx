import { Card, Group, Text, ActionIcon, Modal, Select, Button, Stack, Title, Loader } from '@mantine/core'
import { IconSettings, IconBrandDiscord } from '@tabler/icons-react'
import { useState } from 'react'
import { getGameSystemNameById } from '~/lib'
import { getDiscordServers, formatGuildsForSelect, postCharacterToDiscord } from '../../discord'
import { DiscordServerSelectOption } from '~/types'

// 軽量キャラクターデータ
interface CharacterSummary {
  characterId: string
  characterName: string
  gameSystemId: string
}

interface CharacterCardProps {
  character: CharacterSummary
  onEdit?: () => void
  onClick?: () => void
}

export function CharacterCard({ character, onEdit, onClick }: CharacterCardProps) {
  const [modalOpened, setModalOpened] = useState(false)
  const [selectedServer, setSelectedServer] = useState<string | null>(null)
  const [discordServers, setDiscordServers] = useState<DiscordServerSelectOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDiscordClick = () => {
    setModalOpened(true)
    if (discordServers.length === 0) {
      fetchDiscordServers()
    }
  }

  const fetchDiscordServers = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await getDiscordServers()
      const formattedServers = formatGuildsForSelect(response.guilds)
      setDiscordServers(formattedServers)
    } catch (err) {
      console.error('Failed to fetch Discord servers:', err)
      setError('サーバー一覧の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleServerAdd = async () => {
    if (selectedServer) {
      try {
        setLoading(true)
        setError(null)

        const selectedServerName = discordServers.find(
          (server: DiscordServerSelectOption) => server.value === selectedServer
        )?.label

        // キャラクター情報をDiscordサーバーに投稿
        const result = await postCharacterToDiscord(character.characterId, selectedServer)

        if (result.success) {
          console.log(`キャラクター "${character.characterName}" をサーバー "${selectedServerName}" に投稿しました`)
          setModalOpened(false)
          setSelectedServer(null)
        } else {
          setError(result.error || 'キャラクターの投稿に失敗しました')
        }
      } catch (err) {
        console.error('Failed to post character to Discord:', err)
        setError('キャラクターの投稿中にエラーが発生しました')
      } finally {
        setLoading(false)
      }
    }
  }

  const handleModalClose = () => {
    setModalOpened(false)
    setSelectedServer(null)
    setError(null)
  }

  return (
    <>
      <Card
        shadow="sm"
        padding="lg"
        radius="md"
        withBorder
        style={{
          minHeight: '200px',
          cursor: onClick ? 'pointer' : 'default'
        }}
        onClick={onClick}
      >
        <Group justify="space-between" mt="md" mb="xs">
          <Text fw={500} size="lg" lineClamp={1}>
            {character.characterName}
          </Text>
          {onEdit && (
            <ActionIcon
              variant="light"
              onClick={(e) => {
                e.stopPropagation()
                onEdit()
              }}
            >
              <IconSettings size={16} />
            </ActionIcon>
          )}
        </Group>

        <Text size="sm" c="dimmed" mb="xs">
          System Name: {getGameSystemNameById(character.gameSystemId)}
        </Text>

        <Group justify="flex-end" mt="auto">
          <ActionIcon
            variant="light"
            color="blue"
            onClick={(e) => {
              e.stopPropagation()
              handleDiscordClick()
            }}
          >
            <IconBrandDiscord size={16} />
          </ActionIcon>
        </Group>
      </Card>

      <Modal
        opened={modalOpened}
        onClose={handleModalClose}
        title={
          <Group>
            <IconBrandDiscord size={24} color="#5865F2" />
            <Title order={4}>サーバーに追加：</Title>
          </Group>
        }
        size="md"
        centered
      >
        <Stack gap="md">
          {loading ? (
            <Group justify="center" p="md">
              <Loader size="sm" />
              <Text size="sm" c="dimmed">
                サーバー一覧を読み込み中...
              </Text>
            </Group>
          ) : error ? (
            <Text size="sm" c="red">
              {error}
            </Text>
          ) : (
            <Select
              placeholder="サーバーを選択してください"
              data={discordServers}
              value={selectedServer}
              onChange={setSelectedServer}
              searchable
              clearable
              disabled={loading}
            />
          )}

          <Text size="sm" c="dimmed">
            サーバーのサーバー管理権限が必要です。
          </Text>

          <Group justify="flex-end" gap="sm">
            <Button variant="outline" onClick={handleModalClose}>
              キャンセル
            </Button>
            <Button disabled={!selectedServer || loading} onClick={handleServerAdd}>
              追加
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  )
}

export type { CharacterSummary }
