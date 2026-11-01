'use client'

import {
  Alert,
  Badge,
  Button,
  Card,
  Code,
  Container,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Title
} from '@mantine/core'
import { useState } from 'react'
import { TemplateFormRenderer } from '../../features/characterSheet/TemplateFormRenderer'
import {
  createRendererShowcaseValues,
  rendererShowcaseTemplate
} from './showcase-data'

const phaseSummaries = [
  ['P0', '依存・テスト基線'],
  ['P1', '保存値 reader'],
  ['P2', 'PartsEditorPopover'],
  ['P3', 'ListRowPartsEditor'],
  ['P4', 'ListFieldEditor'],
  ['P5', 'TrackFieldView'],
  ['P6', 'FieldRenderer'],
  ['P7', 'TableFieldLayout'],
  ['P8', 'FieldLayout'],
  ['P9', '全体検証・文書同期']
] as const

export default function CharacterSheetRendererShowcasePage() {
  const [values, setValues] = useState<Record<string, unknown>>(createRendererShowcaseValues)

  const updateValue = (fieldUid: string, value: unknown) => {
    setValues((current) => ({ ...current, [fieldUid]: value }))
  }

  const updatePartValue = (fieldUid: string, partsKey: string, value: number) => {
    setValues((current) => {
      const fieldValue = current[fieldUid]
      const currentParts = readShowcaseParts(fieldValue)

      return {
        ...current,
        [fieldUid]: { parts: { ...currentParts, [partsKey]: value } }
      }
    })
  }

  const reroll = (fieldUid: string) => {
    setValues((current) => {
      const currentValue = current[fieldUid]
      const nextValue = typeof currentValue === 'number' ? (currentValue % 100) + 1 : 1
      return { ...current, [fieldUid]: nextValue }
    })
  }

  return (
    <Container component="main" py="xl" size="xl">
      <Stack gap="xl">
        <Stack gap="xs">
          <Badge variant="light" w="fit-content">TemplateFormRenderer 開発用サンプル</Badge>
          <Title order={1}>Renderer コンポーネント確認</Title>
          <Text c="dimmed" maw={860}>
            P0〜P9 のリファクタ結果を、実際の公開入口と同じ経路で確認するページです。
            入力、内訳 Popover、リスト、トラック、table、grid を操作できます。
          </Text>
          <Group>
            <Button onClick={() => setValues(createRendererShowcaseValues())} variant="light">
              サンプル値をリセット
            </Button>
          </Group>
        </Stack>

        <Card p="lg" radius="md" withBorder>
          <Stack gap="md">
            <Title order={2}>フェーズ対応表</Title>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }} spacing="sm">
              {phaseSummaries.map(([phase, summary]) => (
                <Card key={phase} p="sm" radius="sm" withBorder>
                  <Group align="flex-start" gap="xs" wrap="nowrap">
                    <Badge variant="filled">{phase}</Badge>
                    <Text size="sm">{summary}</Text>
                  </Group>
                </Card>
              ))}
            </SimpleGrid>
            <Alert color="blue" title="P0・P1・P9 について">
              P0 と P9 は基線・全体検証フェーズのため独立した UI を持ちません。
              P1 の保存値 reader は、下の内訳・リスト・トラックの表示値を読む経路で動作しています。
            </Alert>
          </Stack>
        </Card>

        <Card p="lg" radius="md" withBorder>
          <TemplateFormRenderer
            template={rendererShowcaseTemplate}
            values={values}
            onChange={updateValue}
            onPartsChange={updatePartValue}
            creationRollReroll={{ onRequest: reroll }}
          />
        </Card>

        <Card p="lg" radius="md" withBorder>
          <details>
            <summary style={{ cursor: 'pointer' }}>
              <Text component="span" fw={600}>現在のサンプル値</Text>
            </summary>
            <Code block mt="md">{JSON.stringify(values, null, 2)}</Code>
          </details>
        </Card>
      </Stack>
    </Container>
  )
}

function readShowcaseParts(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  if (!('parts' in value)) return {}

  const { parts } = value
  return typeof parts === 'object' && parts !== null && !Array.isArray(parts)
    ? parts as Record<string, unknown>
    : {}
}
