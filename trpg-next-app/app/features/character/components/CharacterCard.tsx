'use client'

import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  Select,
  Stack,
  Text,
  Title,
  Tooltip
} from '@mantine/core'
import { IconAlertTriangle, IconBrandDiscord, IconPencil } from '@tabler/icons-react'
import type { CharacterSummaryWire } from '@trpg/api-contract'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { getGameSystemNameById } from '../../../lib/gameSystem'
import { loadDiscordServers, postCharacterToDiscord } from '../../discord/actions'
import { SHEET_VISIBILITY, SHEET_VISIBILITY_NOTICE } from '../sheet-visibility'

interface DiscordServerSelectOption {
  value: string
  label: string
}

interface CharacterCardProps {
  character: CharacterSummaryWire
  onClick?: () => void
}

export function CharacterCard({ character, onClick }: CharacterCardProps) {
  const [modalOpened, setModalOpened] = useState(false)
  const [selectedServer, setSelectedServer] = useState<string | null>(null)
  const [discordServers, setDiscordServers] = useState<DiscordServerSelectOption[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleDiscordClick = () => {
    setModalOpened(true)
    if (discordServers.length === 0) {
      startTransition(async () => {
        setError(null)
        const result = await loadDiscordServers()
        setError(result.error)
        setDiscordServers(result.servers)
      })
    }
  }

  const handleServerAdd = () => {
    if (!selectedServer) {
      return
    }

    startTransition(async () => {
      setError(null)
      const selectedServerName = discordServers.find((server) => server.value === selectedServer)?.label

      try {
        const result = await postCharacterToDiscord(character.characterId, selectedServer)

        if (result.success) {
          console.log(`キャラクター "${character.characterName}" をサーバー "${selectedServerName}" に投稿しました`)
          setModalOpened(false)
          setSelectedServer(null)
        } else {
          setError(result.error || 'キャラクターの投稿に失敗しました')
        }
      } catch (caughtError) {
        console.error('Failed to post character to Discord:', caughtError)
        setError('キャラクターの投稿中にエラーが発生しました')
      }
    })
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
          <Group gap="xs">
            <Tooltip
              label={SHEET_VISIBILITY_NOTICE}
              withArrow
              events={{ hover: true, focus: true, touch: true }}
            >
              <Badge variant="light" color={SHEET_VISIBILITY[character.visibility].color}>
                {SHEET_VISIBILITY[character.visibility].label}
              </Badge>
            </Tooltip>
            {character.templateVersion && (
              <Tooltip label="テンプレート更新に自動追従しない" withArrow>
                <Badge variant="light" color="accent">
                  template v{character.templateVersion}
                </Badge>
              </Tooltip>
            )}
          </Group>
        </Group>

        <Text size="sm" c="dimmed" mb="xs">
          System Name: {getGameSystemNameById(character.gameSystemId)}
        </Text>

        {character.hub?.status === 'error' && (
          <Alert color="red" icon={<IconAlertTriangle size={16} />} title="Discord hub の更新に失敗しています">
            Discord 権限または接続状態を確認してください。
          </Alert>
        )}

        <Group justify="space-between" mt="auto">
          <Button
            component={Link}
            href={`/user/character/${character.characterId}/sheet`}
            size="xs"
            variant="outline"
            leftSection={<IconPencil size={14} />}
            onClick={(event) => event.stopPropagation()}
          >
            シート編集
          </Button>
          <ActionIcon
            aria-label="Discord サーバーに追加"
            variant="light"
            color="blue"
            onClick={(event) => {
              event.stopPropagation()
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
          {isPending ? (
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
              disabled={isPending}
            />
          )}

          <Text size="sm" c="dimmed">
            サーバーのサーバー管理権限が必要です。
          </Text>

          <Group justify="flex-end" gap="sm">
            <Button variant="outline" onClick={handleModalClose}>
              キャンセル
            </Button>
            <Button disabled={!selectedServer || isPending} onClick={handleServerAdd}>
              追加
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  )
}
