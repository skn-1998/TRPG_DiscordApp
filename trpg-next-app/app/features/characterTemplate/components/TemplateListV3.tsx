'use client'

/* eslint jsx-a11y/no-autofocus: "error" */

import Link from 'next/link'
import { useEffect, useMemo, useState, useTransition } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  Container,
  Group,
  Modal,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title
} from '@mantine/core'
import { IconAlertCircle, IconFilePlus, IconPencil, IconRefresh, IconTrash, IconUserPlus } from '@tabler/icons-react'
import { createCharacter, createTemplate, deleteTemplate, importV2Template } from '../actions'
import type { Template } from '../types/v2'
import type { CharacterSheetTemplateSummary } from '../types/v3'
import { isV2LocalTemplate, migrateV2TemplateToCreateRequest } from '../utils/v3Template'

interface TemplateListV3Props {
  summaries: CharacterSheetTemplateSummary[]
}

export function TemplateListV3({ summaries }: TemplateListV3Props) {
  const [legacyTemplates, setLegacyTemplates] = useState<Template[]>([])
  const [legacyReadError, setLegacyReadError] = useState<string | null>(null)
  const [creationTemplate, setCreationTemplate] = useState<CharacterSheetTemplateSummary | null>(null)
  const [characterName, setCharacterName] = useState('')
  const [listActionError, setListActionError] = useState<string | null>(null)
  const [createCharacterError, setCreateCharacterError] = useState<string | null>(null)
  const [isListPending, startListTransition] = useTransition()
  const [, startCreateCharacterTransition] = useTransition()

  /* eslint-disable react-hooks/set-state-in-effect -- 旧 localStorage 移行導線のマウント時読み込みを維持する。 */
  useEffect(() => {
    try {
      const raw = localStorage.getItem('ct.templates.v2')
      if (!raw) return
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) {
        setLegacyReadError('ct.templates.v2 は配列ではないため移行候補として扱えません')
        return
      }
      setLegacyTemplates(parsed.filter(isV2LocalTemplate))
    } catch {
      setLegacyReadError('ct.templates.v2 の読み込みに失敗しました')
    }
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  const sortedSummaries = useMemo(
    () =>
      [...summaries].sort((a, b) => {
        const aTime = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime()
        const bTime = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime()
        return bTime - aTime
      }),
    [summaries]
  )

  const runListAction = (action: () => Promise<{ error: string | null }>) => {
    startListTransition(async () => {
      const result = await action()
      setListActionError(result.error)
    })
  }

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        <Group justify="space-between" align="center">
          <div>
            <Title order={2}>シートテンプレート</Title>
            <Text size="sm" c="dimmed">
              サーバー draft を正として編集します。
            </Text>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault()
              runListAction(createTemplate)
            }}
          >
            <Button type="submit" leftSection={<IconFilePlus size={16} />} loading={isListPending}>
              新規作成
            </Button>
          </form>
        </Group>

        {(listActionError || createCharacterError) && (
          <Alert color="red" icon={<IconAlertCircle size={16} />} title="テンプレート一覧の処理に失敗しました">
            {listActionError ?? createCharacterError}
          </Alert>
        )}

        {sortedSummaries.length === 0 ? (
          <Alert color="blue" title="テンプレートがありません">
            新規作成から draft を作成してください。
          </Alert>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {sortedSummaries.map((summary) => (
              <Card key={summary.templateId} withBorder radius="md" p="md">
                <Stack gap="sm">
                  <Group justify="space-between" align="start">
                    <div>
                      <Text fw={700}>{summary.name}</Text>
                      <Text size="xs" c="dimmed">
                        v{summary.version} / rev {summary.draftRevision}
                      </Text>
                    </div>
                    <Badge color={summary.status === 'draft' ? 'yellow' : 'green'}>{summary.status}</Badge>
                  </Group>

                  <Group gap="xs">
                    <Badge variant="outline">{summary.visibility}</Badge>
                    {summary.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="light" color="accent">
                        {tag}
                      </Badge>
                    ))}
                  </Group>

                  <Group justify="space-between" mt="xs" wrap="wrap">
                    <Button
                      component={Link}
                      href={`/templates/${summary.templateId}/edit`}
                      size="xs"
                      variant="outline"
                      leftSection={<IconPencil size={14} />}
                    >
                      編集
                    </Button>
                    {summary.status === 'published' && (
                      <Button
                        type="button"
                        size="xs"
                        variant="light"
                        leftSection={<IconUserPlus size={14} />}
                        onClick={() => {
                          setCharacterName('')
                          setCreationTemplate(summary)
                        }}
                      >
                        このテンプレートで作成
                      </Button>
                    )}
                    <form
                      onSubmit={(event) => {
                        event.preventDefault()
                        runListAction(() => deleteTemplate(summary.templateId))
                      }}
                    >
                      <Button
                        type="submit"
                        size="xs"
                        color="red"
                        variant="subtle"
                        leftSection={<IconTrash size={14} />}
                      >
                        削除
                      </Button>
                    </form>
                  </Group>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>
        )}

        {(legacyReadError || legacyTemplates.length > 0) && (
          <Card withBorder radius="md" p="md">
            <Stack gap="sm">
              <Group gap="xs">
                <IconRefresh size={16} />
                <Text fw={700}>schemaVersion 2 localStorage 移行候補</Text>
              </Group>
              <Text size="sm" c="dimmed">
                localStorage は復旧・移行用としてのみ読みます。移行ボタンを押すと v3 draft をサーバーに作成します。
              </Text>
              {legacyReadError && (
                <Alert color="yellow" icon={<IconAlertCircle size={16} />}>
                  {legacyReadError}
                </Alert>
              )}
              {legacyTemplates.map((template) => (
                <Group key={template.id} justify="space-between">
                  <Text size="sm">{template.name}</Text>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault()
                      runListAction(() => importV2Template(migrateV2TemplateToCreateRequest(template)))
                    }}
                  >
                    <Button type="submit" size="xs" variant="outline">
                      v3 draft として作成
                    </Button>
                  </form>
                </Group>
              ))}
            </Stack>
          </Card>
        )}

        <Modal
          opened={creationTemplate !== null}
          onClose={() => setCreationTemplate(null)}
          title="テンプレートからキャラクターを作成"
          centered
        >
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (!creationTemplate) return
              startCreateCharacterTransition(async () => {
                const result = await createCharacter({
                  templateId: creationTemplate.templateId,
                  templateVersion: creationTemplate.version,
                  characterName
                })
                setCreateCharacterError(result.error)
              })
            }}
          >
            <Stack gap="md">
              <Text size="sm" c="dimmed">
                {creationTemplate?.name} / v{creationTemplate?.version}
              </Text>
              <TextInput
                name="characterName"
                label="キャラクター名"
                value={characterName}
                onChange={(event) => setCharacterName(event.currentTarget.value)}
                required
                // eslint-disable-next-line jsx-a11y/no-autofocus -- 既存 UX の意図的維持（S3c で lint ゲート化のため既存挙動を変えずに抑制）
                autoFocus
              />
              {createCharacterError && (
                <Alert color="red" icon={<IconAlertCircle size={16} />}>
                  {createCharacterError}
                </Alert>
              )}
              <Group justify="flex-end">
                <Button type="button" variant="outline" onClick={() => setCreationTemplate(null)}>
                  キャンセル
                </Button>
                <Button type="submit" disabled={!characterName.trim()}>
                  作成
                </Button>
              </Group>
            </Stack>
          </form>
        </Modal>
      </Stack>
    </Container>
  )
}
