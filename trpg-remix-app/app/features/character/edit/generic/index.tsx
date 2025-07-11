// 汎用キャラクターシート作成・編集メインコンポーネント

import { useState } from 'react'
import { Stack, Title, Button, Group, Container, Card, Tabs } from '@mantine/core'
import { IconTemplate, IconEye, IconDeviceFloppy } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { GridEditor, DynamicSheet } from './components'
import { GridTemplate, CharacterSheet, createEmptyTemplate, createEmptySheet } from './types'

interface GenericCharacterEditProps {
  initialTemplate?: GridTemplate
  initialSheet?: CharacterSheet
  onTemplateSave?: (template: GridTemplate) => void
  onSheetSave?: (sheet: CharacterSheet) => void
  onCancel?: () => void
}

export function GenericCharacterEdit({
  initialTemplate,
  initialSheet,
  onTemplateSave,
  onSheetSave,
  onCancel
}: GenericCharacterEditProps) {
  const [template, setTemplate] = useState<GridTemplate>(
    initialTemplate || createEmptyTemplate()
  )
  const [sheet, setSheet] = useState<CharacterSheet>(
    initialSheet || createEmptySheet(template.id, '')
  )
  const [activeTab, setActiveTab] = useState<string>('template')

  const handleTemplateSave = () => {
    if (!template.name.trim()) {
      notifications.show({
        title: '入力エラー',
        message: 'テンプレート名を入力してください',
        color: 'red'
      })
      return
    }

    if (template.cells.size === 0) {
      notifications.show({
        title: '入力エラー',
        message: '少なくとも1つのセルを追加してください',
        color: 'red'
      })
      return
    }

    onTemplateSave?.(template)
    notifications.show({
      title: 'テンプレートが保存されました',
      message: `${template.name}のテンプレートが保存されました`,
      color: 'green'
    })
  }

  const handleSheetSave = (savedSheet: CharacterSheet) => {
    onSheetSave?.(savedSheet)
    notifications.show({
      title: 'シートが保存されました',
      message: 'キャラクターシートが保存されました',
      color: 'green'
    })
  }

  const handleSheetChange = (updatedSheet: CharacterSheet) => {
    setSheet(updatedSheet)
  }

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* ヘッダー */}
        <Card withBorder radius="md" p="lg">
          <Group justify="space-between" align="center">
            <Title order={1} c="sub.5">
              汎用キャラクターシート作成
            </Title>
            <Group>
              {onCancel && (
                <Button variant="light" onClick={onCancel}>
                  キャンセル
                </Button>
              )}
            </Group>
          </Group>
        </Card>

        {/* タブ */}
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="template" leftSection={<IconTemplate size={16} />}>
              テンプレート編集
            </Tabs.Tab>
            <Tabs.Tab value="preview" leftSection={<IconEye size={16} />}>
              プレビュー
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="template" pt="md">
            <GridEditor
              template={template}
              onTemplateChange={setTemplate}
              onSave={handleTemplateSave}
            />
          </Tabs.Panel>

          <Tabs.Panel value="preview" pt="md">
            <Stack gap="md">
              <Card withBorder p="md">
                <Group justify="space-between">
                  <Title order={3}>プレビュー</Title>
                  <Button
                    leftSection={<IconDeviceFloppy size={16} />}
                    onClick={() => handleSheetSave(sheet)}
                  >
                    シートを保存
                  </Button>
                </Group>
              </Card>
              
              <DynamicSheet
                template={template}
                sheet={sheet}
                onSheetChange={handleSheetChange}
                onSave={handleSheetSave}
              />
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Container>
  )
}

// 汎用機能のエクスポート
export * from './types'
export * from './components'
export * from './utils'