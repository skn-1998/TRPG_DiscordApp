'use client'

/* eslint jsx-a11y/no-autofocus: "error" */

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import type { RollOnCreateResultWire } from '@trpg/api-contract'
import {
  Alert,
  Badge,
  Button,
  Card,
  Container,
  CopyButton,
  Group,
  Modal,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title
} from '@mantine/core'
import {
  IconAlertCircle,
  IconClipboard,
  IconCopy,
  IconFileImport,
  IconFilePlus,
  IconPencil,
  IconRefresh,
  IconTrash,
  IconUserPlus
} from '@tabler/icons-react'
import { createCharacter, createTemplate, deleteTemplate, forkTemplate, importTemplate } from '../actions'
import { SYSTEM_TEMPLATE_AUTHOR } from '../constants'
import { TEMPLATE_GENERATION_PROMPT } from '../templateGenerationPrompt'
import type { Template } from '../types/v2'
import type { CharacterSheetTemplateSummary } from '../types/v3'
import { isV2LocalTemplate, migrateV2TemplateToCreateRequest, parseTemplateImportJson } from '../utils/v3Template'

interface TemplateListV3Props {
  summaries: CharacterSheetTemplateSummary[]
}

type CharacterCreationOutcome =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'rolls'; results: RollOnCreateResultWire[] }

export function TemplateListV3({ summaries }: TemplateListV3Props) {
  const [legacyTemplates, setLegacyTemplates] = useState<Template[]>([])
  const [legacyReadError, setLegacyReadError] = useState<string | null>(null)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [templateImportJson, setTemplateImportJson] = useState('')
  const [templateImportError, setTemplateImportError] = useState<string | null>(null)
  const [creationTemplate, setCreationTemplate] = useState<CharacterSheetTemplateSummary | null>(null)
  const [characterName, setCharacterName] = useState('')
  const [listActionError, setListActionError] = useState<string | null>(null)
  const [creationOutcome, setCreationOutcome] = useState<CharacterCreationOutcome>({ status: 'idle' })
  const [isListPending, startListTransition] = useTransition()
  // モーダル内送信の pending を一覧側ボタンへ波及させない。
  const [isCreateCharacterPending, startCreateCharacterTransition] = useTransition()
  const importRequestGenerationRef = useRef(0)
  const creationRequestGenerationRef = useRef(0)
  const createCharacterError = creationOutcome.status === 'error' ? creationOutcome.message : null

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

  const resetImportModal = () => {
    // close 後に完了した import action が、次に開く Modal のエラー state を上書きしないよう無効化する。
    importRequestGenerationRef.current += 1
    setIsImportModalOpen(false)
    setTemplateImportJson('')
    setTemplateImportError(null)
  }

  const resetCreationModal = () => {
    // close 後に完了した旧リクエストが、次に開く Modal の状態を上書きしないよう無効化する。
    creationRequestGenerationRef.current += 1
    setCreationTemplate(null)
    setCharacterName('')
    setCreationOutcome({ status: 'idle' })
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

          <Group gap="sm">
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
            <Button
              type="button"
              variant="outline"
              leftSection={<IconFileImport size={16} />}
              onClick={() => setIsImportModalOpen(true)}
            >
              JSON から作成
            </Button>
          </Group>
        </Group>

        {listActionError && (
          <Alert color="red" icon={<IconAlertCircle size={16} />} title="テンプレート一覧の処理に失敗しました">
            {listActionError}
          </Alert>
        )}

        {sortedSummaries.length === 0 ? (
          <Alert color="blue" title="テンプレートがありません">
            新規作成から draft を作成してください。
          </Alert>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {sortedSummaries.map((summary) => {
              const isSystemTemplate = summary.authorDiscordUserId === SYSTEM_TEMPLATE_AUTHOR

              return (
                <Card key={summary.templateId} withBorder radius="md" p="md">
                  <Stack gap="sm">
                    <Group justify="space-between" align="start">
                      <div>
                        <Text fw={700}>{summary.name}</Text>
                        <Text size="xs" c="dimmed">
                          v{summary.version} / rev {summary.draftRevision}
                        </Text>
                      </div>
                      <Group gap="xs">
                        {isSystemTemplate && <Badge color="blue">配布</Badge>}
                        <Badge color={summary.status === 'draft' ? 'yellow' : 'green'}>{summary.status}</Badge>
                      </Group>
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
                      {!isSystemTemplate && (
                        <Button
                          component={Link}
                          href={`/templates/${summary.templateId}/edit`}
                          size="xs"
                          variant="outline"
                          leftSection={<IconPencil size={14} />}
                        >
                          編集
                        </Button>
                      )}
                      <form
                        onSubmit={(event) => {
                          event.preventDefault()
                          runListAction(() => forkTemplate(summary.templateId))
                        }}
                      >
                        <Button
                          type="submit"
                          size="xs"
                          variant="outline"
                          leftSection={<IconCopy size={14} />}
                          loading={isListPending}
                        >
                          複製して編集
                        </Button>
                      </form>
                      {summary.status === 'published' && (
                        <>
                          <Button
                            component={Link}
                            href={{
                              pathname: `/templates/${summary.templateId}/create`,
                              query: { version: summary.version }
                            }}
                            size="xs"
                            variant="filled"
                            leftSection={<IconUserPlus size={14} />}
                          >
                            シートを入力して作成
                          </Button>
                          <Button
                            type="button"
                            size="xs"
                            variant="light"
                            onClick={() => {
                              setCharacterName('')
                              setCreationOutcome({ status: 'idle' })
                              setCreationTemplate(summary)
                            }}
                          >
                            名前だけで作成
                          </Button>
                        </>
                      )}
                      {!isSystemTemplate && (
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
                            loading={isListPending}
                          >
                            削除
                          </Button>
                        </form>
                      )}
                    </Group>
                  </Stack>
                </Card>
              )
            })}
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
                      runListAction(() => importTemplate(migrateV2TemplateToCreateRequest(template)))
                    }}
                  >
                    <Button type="submit" size="xs" variant="outline" loading={isListPending}>
                      v3 draft として作成
                    </Button>
                  </form>
                </Group>
              ))}
            </Stack>
          </Card>
        )}

        <Modal
          opened={isImportModalOpen}
          onClose={resetImportModal}
          title="JSON からテンプレートを作成"
          centered
        >
          <form
            onSubmit={(event) => {
              event.preventDefault()
              const parsed = parseTemplateImportJson(templateImportJson)
              if (!parsed.ok) {
                setTemplateImportError(parsed.error)
                return
              }

              setTemplateImportError(null)
              const requestGeneration = ++importRequestGenerationRef.current
              startListTransition(async () => {
                const result = await importTemplate(parsed.payload)
                if (requestGeneration !== importRequestGenerationRef.current) return
                setTemplateImportError(result.error)
              })
            }}
          >
            <Stack gap="md">
              <Textarea
                label="テンプレート JSON"
                value={templateImportJson}
                onChange={(event) => setTemplateImportJson(event.currentTarget.value)}
                minRows={12}
                autosize={false}
                placeholder='{"name": "テンプレート名", "sections": []}'
                styles={{ input: { fontFamily: 'monospace' } }}
              />
              <Stack gap="xs">
                <Text size="xs" c="dimmed">
                  JSON の作り方が分からないときは、下のボタンでプロンプトをコピーして ChatGPT や Claude などの
                  AI に貼り付け、続けて作りたいゲーム名やルールの説明を書いて送ると、JSON の生成を依頼できます。返答のうち JSON
                  オブジェクトの部分だけをここに貼り付けてください。作成時に検証エラーが出たら、エラー文を AI
                  に貼り返すと修正しやすくなります。
                </Text>
                <CopyButton value={TEMPLATE_GENERATION_PROMPT}>
                  {({ copied, copy }) => (
                    <Button
                      type="button"
                      size="xs"
                      variant="light"
                      leftSection={<IconClipboard size={14} />}
                      onClick={copy}
                    >
                      {copied ? 'コピーしました' : '生成用プロンプトをコピー'}
                    </Button>
                  )}
                </CopyButton>
              </Stack>
              {templateImportError && (
                <Alert color="red" icon={<IconAlertCircle size={16} />}>
                  {templateImportError}
                </Alert>
              )}
              <Group justify="flex-end">
                <Button type="button" variant="outline" onClick={resetImportModal}>
                  キャンセル
                </Button>
                <Button type="submit" loading={isListPending}>
                  作成
                </Button>
              </Group>
            </Stack>
          </form>
        </Modal>

        <Modal
          opened={creationTemplate !== null}
          onClose={resetCreationModal}
          title="テンプレートからキャラクターを作成"
          centered
        >
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (!creationTemplate) return
              const requestGeneration = ++creationRequestGenerationRef.current
              startCreateCharacterTransition(async () => {
                const result = await createCharacter({
                  templateId: creationTemplate.templateId,
                  templateVersion: creationTemplate.version,
                  characterName
                })
                if (requestGeneration !== creationRequestGenerationRef.current) return
                if (result.error) {
                  setCreationOutcome({ status: 'error', message: result.error })
                  return
                }

                const rollResults = result.rollOnCreateResults ?? []
                setCreationOutcome(
                  rollResults.length > 0 ? { status: 'rolls', results: rollResults } : { status: 'idle' }
                )
              })
            }}
          >
            <Stack gap="md">
              <Text size="sm" c="dimmed">
                {creationTemplate?.name} / v{creationTemplate?.version}
              </Text>
              {creationOutcome.status === 'rolls' ? (
                <>
                  <Stack gap="xs">
                    <Text size="sm" fw={700}>
                      作成時の出目
                    </Text>
                    {/* total は作成値と一致するが、details 末尾にも評価値が含まれるため重複表示しない。 */}
                    {creationOutcome.results.map((result) => (
                      <Text key={result.uid} size="xs" c="dimmed">
                        {result.label}: {result.details}
                      </Text>
                    ))}
                  </Stack>
                  <Group justify="flex-end">
                    <Button component={Link} href="/user/character" onClick={resetCreationModal}>
                      キャラクター一覧へ
                    </Button>
                  </Group>
                </>
              ) : (
                <>
                  <TextInput
                    name="characterName"
                    label="キャラクター名"
                    value={characterName}
                    onChange={(event) => setCharacterName(event.currentTarget.value)}
                    required
                    // eslint-disable-next-line jsx-a11y/no-autofocus -- 既存 UX の意図的維持（lint ゲート化時に既存挙動を変えずに抑制）。
                    autoFocus
                  />
                  {createCharacterError && (
                    <Alert color="red" icon={<IconAlertCircle size={16} />}>
                      {createCharacterError}
                    </Alert>
                  )}
                  <Group justify="flex-end">
                    <Button type="button" variant="outline" onClick={resetCreationModal}>
                      キャンセル
                    </Button>
                    <Button type="submit" loading={isCreateCharacterPending} disabled={!characterName.trim()}>
                      作成
                    </Button>
                  </Group>
                </>
              )}
            </Stack>
          </form>
        </Modal>
      </Stack>
    </Container>
  )
}
