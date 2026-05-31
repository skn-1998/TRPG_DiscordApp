import { useState } from 'react'
import { Editor, Preview } from '~/features/characterTemplate'
import { Container, Tabs, Paper, Title } from '@mantine/core'
import { IconEdit, IconEye, IconPalette } from '@tabler/icons-react'

export default function TemplateEditor() {
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
          {/* 将来的に表示カスタマイズタブを追加可能 */}
          {/* <Tabs.Tab value="customize" leftSection={<IconPalette size={16} />}>
            表示カスタマイズ
          </Tabs.Tab> */}
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

        {/* 将来的に表示カスタマイズタブを追加可能 */}
        {/* <Tabs.Panel value="customize" pt="md">
          <Paper p="md" withBorder>
            <DisplayCustomizer />
          </Paper>
        </Tabs.Panel> */}
      </Tabs>
    </Container>
  )
}
