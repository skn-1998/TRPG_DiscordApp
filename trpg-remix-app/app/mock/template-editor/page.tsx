'use client'

import { useState } from 'react'
import { Container, Paper, Tabs, Title } from '@mantine/core'
import { IconEdit, IconEye } from '@tabler/icons-react'
import { Editor, Preview } from '~/features/characterTemplate'

export default function TemplateEditorPage() {
  const [activeTab, setActiveTab] = useState<string | null>('editor')

  return (
    <Container size="xl">
      <Title order={2} mb="md">
        キャラクターシートテンプレートエディタ
      </Title>
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="editor" leftSection={<IconEdit size={16} />}>
            エディタ
          </Tabs.Tab>
          <Tabs.Tab value="preview" leftSection={<IconEye size={16} />}>
            プレビュー
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="editor" pt="md">
          <Paper p="md" withBorder>
            <Editor />
          </Paper>
        </Tabs.Panel>
        <Tabs.Panel value="preview" pt="md">
          <Paper p="md" withBorder>
            <Preview />
          </Paper>
        </Tabs.Panel>
      </Tabs>
    </Container>
  )
}
