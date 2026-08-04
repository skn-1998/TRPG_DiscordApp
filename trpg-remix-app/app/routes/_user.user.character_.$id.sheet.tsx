import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node'
import { Form, Link, useActionData, useLoaderData } from '@remix-run/react'
import { Alert, Button, Card, Container, Group, NumberInput, Stack, Text, TextInput, Title } from '@mantine/core'
import { IconAlertCircle, IconArrowLeft, IconDeviceFloppy } from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import { getCharacter, saveCharacterSheet, type CharacterSheetChange } from '~/features/character/api/character.service'
import {
  extractApiErrorMessages,
  getSheetTemplate,
  type CharacterSheetTemplateEntity,
  type SheetField
} from '~/features/characterTemplate'
import { getJwtFromRequest } from '~/features/auth/api/auth.service'
import { clearServerRequestContext, setServerRequestContext } from '~/lib/api-client'
import { getResponseStatus } from '~/lib/api-response.util'

type SheetActionData = {
  error?: string
  conflict?: boolean
}

type EditableScalarField = Extract<SheetField, { type: 'scalar' }> & {
  valueType: 'number' | 'text'
}

type EditorValue = string | number | undefined

function editableScalarFields(template: CharacterSheetTemplateEntity): EditableScalarField[] {
  return template.sections.flatMap((section) =>
    section.fields.filter(
      (field): field is EditableScalarField =>
        field.type === 'scalar' && (field.valueType === 'number' || field.valueType === 'text')
    )
  )
}

function readEditableValue(field: EditableScalarField, values: Record<string, unknown>): EditorValue {
  const raw = values[field.uid]
  if (field.valueType === 'number' && field.parts) {
    if (typeof raw === 'number') return raw
    if (raw && typeof raw === 'object' && 'parts' in raw) {
      const parts = (raw as { parts?: Record<string, unknown> }).parts
      return typeof parts?.base === 'number' ? parts.base : undefined
    }
    return undefined
  }
  if (field.valueType === 'number') return typeof raw === 'number' ? raw : undefined
  return typeof raw === 'string' ? raw : undefined
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const jwt = getJwtFromRequest(request)
  if (!jwt) throw redirect('/login')
  if (!params.id) throw new Response('characterId がありません', { status: 400 })

  try {
    setServerRequestContext(request, jwt)
    const character = await getCharacter(params.id)
    if (!character.sheet) throw new Response('materialized キャラクターではありません', { status: 409 })
    const template = await getSheetTemplate(character.sheet.templateId, jwt)
    return json({ character, template })
  } finally {
    clearServerRequestContext()
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  const jwt = getJwtFromRequest(request)
  if (!jwt) throw redirect('/login')
  if (!params.id) return json<SheetActionData>({ error: 'characterId がありません' }, { status: 400 })

  const formData = await request.formData()
  const payload = formData.get('payload')
  if (typeof payload !== 'string') {
    return json<SheetActionData>({ error: '保存内容がありません' }, { status: 400 })
  }

  try {
    const parsed = JSON.parse(payload) as { baseRevision: number; changes: CharacterSheetChange[] }
    setServerRequestContext(request, jwt)
    await saveCharacterSheet({ characterId: params.id, ...parsed })
    return redirect('/user/character')
  } catch (error) {
    const message = extractApiErrorMessages(error).join(' / ')
    if (getResponseStatus(error) === 409) {
      return json<SheetActionData>(
        { conflict: true, error: '他の操作でシートが更新されました。ページを再読み込みしてから再入力してください。' },
        { status: 409 }
      )
    }
    return json<SheetActionData>({ error: message }, { status: getResponseStatus(error) ?? 400 })
  } finally {
    clearServerRequestContext()
  }
}

export default function CharacterSheetEditRoute() {
  const { character, template } = useLoaderData<typeof loader>()
  const actionData = useActionData<SheetActionData>()
  const fields = useMemo(() => editableScalarFields(template), [template])
  const baseValues = character.sheet!.values
  const [values, setValues] = useState<Record<string, EditorValue>>(() =>
    Object.fromEntries(fields.map((field) => [field.uid, readEditableValue(field, baseValues)]))
  )

  const hasInvalidNumber = fields.some((field) => field.valueType === 'number' && values[field.uid] === '')
  const changes: CharacterSheetChange[] = fields.flatMap((field) => {
    const baseValue = readEditableValue(field, baseValues)
    const newValue = values[field.uid]
    if (Object.is(baseValue, newValue)) return []
    return [
      {
        path: { fieldUid: field.uid, ...(field.parts ? { partsKey: 'base' } : {}) },
        baseValue,
        newValue
      }
    ]
  })
  const payload = JSON.stringify({ baseRevision: character.sheet!.revision, changes })

  return (
    <Container size="sm" py="xl">
      <Stack gap="lg">
        <Group justify="space-between">
          <div>
            <Title order={2}>{character.characterName} のシート編集</Title>
            <Text size="sm" c="dimmed">
              {template.name} v{character.sheet!.templateVersion} / revision {character.sheet!.revision}
            </Text>
          </div>
          <Button component={Link} to="/user/character" variant="subtle" leftSection={<IconArrowLeft size={16} />}>
            一覧へ
          </Button>
        </Group>

        {actionData?.error && (
          <Alert
            color={actionData.conflict ? 'yellow' : 'red'}
            icon={<IconAlertCircle size={16} />}
            title={actionData.conflict ? '保存競合' : '保存できませんでした'}
          >
            {actionData.error}
          </Alert>
        )}

        <Card withBorder radius="md" p="lg">
          {fields.length === 0 ? (
            <Alert color="blue">このテンプレートには編集対象の number/text scalar がありません。</Alert>
          ) : (
            <Form method="post">
              <Stack gap="md">
                <input type="hidden" name="payload" value={payload} />
                {fields.map((field) =>
                  field.valueType === 'number' ? (
                    <NumberInput
                      key={field.uid}
                      label={field.label}
                      description={field.description}
                      value={values[field.uid] ?? ''}
                      onChange={(value) => setValues((current) => ({ ...current, [field.uid]: value }))}
                      required
                    />
                  ) : (
                    <TextInput
                      key={field.uid}
                      label={field.label}
                      description={field.description}
                      value={typeof values[field.uid] === 'string' ? values[field.uid] : ''}
                      onChange={(event) =>
                        setValues((current) => ({ ...current, [field.uid]: event.currentTarget.value }))
                      }
                    />
                  )
                )}
                <Group justify="flex-end">
                  <Button
                    type="submit"
                    leftSection={<IconDeviceFloppy size={16} />}
                    disabled={hasInvalidNumber || changes.length === 0}
                  >
                    変更を保存
                  </Button>
                </Group>
              </Stack>
            </Form>
          )}
        </Card>
      </Stack>
    </Container>
  )
}
