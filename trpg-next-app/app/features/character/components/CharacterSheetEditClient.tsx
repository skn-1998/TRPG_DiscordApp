'use client'

import { Alert, Button, Card, Container, Group, NumberInput, Stack, Text, TextInput, Title } from '@mantine/core'
import { IconAlertCircle, IconArrowLeft, IconDeviceFloppy } from '@tabler/icons-react'
import type { CharacterWire } from '@trpg/api-contract'
import Link from 'next/link'
import { type FormEvent, useMemo, useState, useTransition } from 'react'
import type { CharacterSheetTemplateEntity } from '../../characterTemplate/types/v3'
import { saveSheet } from '../actions'
import { deriveSheetChanges, editableScalarFields, readEditableValue, type EditorValue } from '../sheet-edit'

interface CharacterSheetEditClientProps {
  character: CharacterWire
  template: CharacterSheetTemplateEntity
}

interface SheetActionData {
  error: string | null
  conflict?: boolean
}

export function CharacterSheetEditClient({ character, template }: CharacterSheetEditClientProps) {
  const fields = useMemo(() => editableScalarFields(template), [template])
  const baseValues = character.sheet!.values
  const [values, setValues] = useState<Record<string, EditorValue>>(() =>
    Object.fromEntries(fields.map((field) => [field.uid, readEditableValue(field, baseValues)]))
  )
  const [actionData, setActionData] = useState<SheetActionData | null>(null)
  const [isPending, startTransition] = useTransition()

  const hasInvalidNumber = fields.some((field) => field.valueType === 'number' && values[field.uid] === '')
  const changes = deriveSheetChanges(fields, baseValues, values)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    startTransition(async () => {
      const result = await saveSheet(character.characterId, {
        baseRevision: character.sheet!.revision,
        changes
      })
      setActionData(result)
    })
  }

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
          <Button
            component={Link}
            href="/user/character"
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
          >
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
            <form onSubmit={handleSubmit}>
              <Stack gap="md">
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
                    loading={isPending}
                  >
                    変更を保存
                  </Button>
                </Group>
              </Stack>
            </form>
          )}
        </Card>
      </Stack>
    </Container>
  )
}
