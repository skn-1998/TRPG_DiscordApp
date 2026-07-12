import { useEffect, useMemo, useState } from 'react'
import { Form, Link, useFetcher } from '@remix-run/react'
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
import type { CharacterSheetTemplateSummary, Template } from '../types'
import { isV2LocalTemplate, migrateV2TemplateToCreateRequest } from '../utils/v3Template'

interface TemplateListV3Props {
  summaries: CharacterSheetTemplateSummary[]
  error?: string | null
  actionError?: string | null
}

type TemplateListActionData = {
  error?: string
}

export function TemplateListV3({ summaries, error, actionError }: TemplateListV3Props) {
  const fetcher = useFetcher<TemplateListActionData>()
  const [legacyTemplates, setLegacyTemplates] = useState<Template[]>([])
  const [legacyReadError, setLegacyReadError] = useState<string | null>(null)
  const [creationTemplate, setCreationTemplate] = useState<CharacterSheetTemplateSummary | null>(null)
  const [characterName, setCharacterName] = useState('')

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

  const sortedSummaries = useMemo(
    () =>
      [...summaries].sort((a, b) => {
        const aTime = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime()
        const bTime = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime()
        return bTime - aTime
      }),
    [summaries]
  )

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

          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="create" />
            <Button type="submit" leftSection={<IconFilePlus size={16} />} loading={fetcher.state !== 'idle'}>
              新規作成
            </Button>
          </fetcher.Form>
        </Group>

        {(error || fetcher.data?.error || actionError) && (
          <Alert color="red" icon={<IconAlertCircle size={16} />} title="テンプレート一覧の処理に失敗しました">
            {error ?? fetcher.data?.error ?? actionError}
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
                      to={`/templates/${summary.templateId}/edit`}
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
                    <fetcher.Form method="post">
                      <input type="hidden" name="intent" value="delete" />
                      <input type="hidden" name="templateId" value={summary.templateId} />
                      <Button
                        type="submit"
                        size="xs"
                        color="red"
                        variant="subtle"
                        leftSection={<IconTrash size={14} />}
                      >
                        削除
                      </Button>
                    </fetcher.Form>
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
                  <fetcher.Form method="post">
                    <input type="hidden" name="intent" value="import-v2" />
                    <input
                      type="hidden"
                      name="payload"
                      value={JSON.stringify(migrateV2TemplateToCreateRequest(template))}
                    />
                    <Button type="submit" size="xs" variant="outline">
                      v3 draft として作成
                    </Button>
                  </fetcher.Form>
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
          <Form method="post">
            <Stack gap="md">
              <Text size="sm" c="dimmed">
                {creationTemplate?.name} / v{creationTemplate?.version}
              </Text>
              <input type="hidden" name="intent" value="create-character" />
              <input type="hidden" name="templateId" value={creationTemplate?.templateId ?? ''} />
              <input type="hidden" name="templateVersion" value={creationTemplate?.version ?? ''} />
              <TextInput
                name="characterName"
                label="キャラクター名"
                value={characterName}
                onChange={(event) => setCharacterName(event.currentTarget.value)}
                required
                autoFocus
              />
              {actionError && (
                <Alert color="red" icon={<IconAlertCircle size={16} />}>
                  {actionError}
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
          </Form>
        </Modal>
      </Stack>
    </Container>
  )
}
