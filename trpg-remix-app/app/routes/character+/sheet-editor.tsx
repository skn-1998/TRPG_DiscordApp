import { useState } from 'react'
import { Container, Title, Card, Text, Group, Button, Stack } from '@mantine/core'
import { IconPlus, IconTemplate, IconEye } from '@tabler/icons-react'
import { CharacterSheetTemplate } from '~/types/characterSheet'

// サンプルテンプレート
const sampleTemplate: CharacterSheetTemplate = {
  id: 'sample_cthulhu',
  name: 'クトゥルフ神話TRPG キャラクターシート',
  gameSystemId: 'Cthulhu',
  version: '1.0',
  author: 'System',
  description: 'クトゥルフ神話TRPGの基本的なキャラクターシート',
  gridSize: { rows: 12, cols: 6 },
  cells: [
    {
      id: 'cell_name',
      name: 'キャラクター名',
      value: '',
      type: 'text',
      row: 0,
      col: 0,
      colSpan: 3
    },
    {
      id: 'cell_str',
      name: 'STR',
      value: '3d6*5',
      type: 'stat',
      row: 1,
      col: 0
    },
    {
      id: 'cell_con',
      name: 'CON',
      value: '3d6*5',
      type: 'stat',
      row: 1,
      col: 1
    },
    {
      id: 'cell_pow',
      name: 'POW',
      value: '3d6*5',
      type: 'stat',
      row: 1,
      col: 2
    },
    {
      id: 'cell_dex',
      name: 'DEX',
      value: '3d6*5',
      type: 'stat',
      row: 2,
      col: 0
    },
    {
      id: 'cell_app',
      name: 'APP',
      value: '3d6*5',
      type: 'stat',
      row: 2,
      col: 1
    },
    {
      id: 'cell_siz',
      name: 'SIZ',
      value: '3d6*5',
      type: 'stat',
      row: 2,
      col: 2
    },
    {
      id: 'cell_int',
      name: 'INT',
      value: '(2d6+6)*5',
      type: 'stat',
      row: 3,
      col: 0
    },
    {
      id: 'cell_edu',
      name: 'EDU',
      value: '(2d6+6)*5',
      type: 'stat',
      row: 3,
      col: 1
    },
    {
      id: 'cell_hp',
      name: 'HP',
      value: '([CON]+[SIZ])/10',
      type: 'calculated',
      row: 4,
      col: 0
    },
    {
      id: 'cell_mp',
      name: 'MP',
      value: '[POW]/5',
      type: 'calculated',
      row: 4,
      col: 1
    },
    {
      id: 'cell_san',
      name: 'SAN',
      value: '[POW]',
      type: 'calculated',
      row: 4,
      col: 2
    }
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}

export default function CharacterSheetEditor() {
  const [templates, setTemplates] = useState<CharacterSheetTemplate[]>([sampleTemplate])
  const [selectedTemplate, setSelectedTemplate] = useState<CharacterSheetTemplate | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  const createNewTemplate = () => {
    const newTemplate: CharacterSheetTemplate = {
      id: `template_${Date.now()}`,
      name: '新しいテンプレート',
      gameSystemId: '',
      version: '1.0',
      author: '',
      description: '',
      gridSize: { rows: 10, cols: 6 },
      cells: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    setSelectedTemplate(newTemplate)
    setIsEditing(true)
  }

  const editTemplate = (template: CharacterSheetTemplate) => {
    setSelectedTemplate(template)
    setIsEditing(true)
  }

  const saveTemplate = (template: CharacterSheetTemplate) => {
    setTemplates(prev => {
      const existingIndex = prev.findIndex(t => t.id === template.id)
      if (existingIndex >= 0) {
        const newTemplates = [...prev]
        newTemplates[existingIndex] = template
        return newTemplates
      } else {
        return [...prev, template]
      }
    })
    setIsEditing(false)
    setSelectedTemplate(null)
  }

  const previewTemplate = (template: CharacterSheetTemplate) => {
    // プレビュー機能（今後実装）
    console.log('Preview template:', template)
  }

  if (isEditing && selectedTemplate) {
    return (
      <div>
        <h1>キャラクターシートエディタ</h1>
        <p>現在、エディタ機能を実装中です。</p>
        <Button onClick={() => setIsEditing(false)}>戻る</Button>
        
        {/* 簡単なプレビュー */}
        <div style={{ marginTop: '20px' }}>
          <h3>{selectedTemplate.name}</h3>
          <p>ゲームシステム: {selectedTemplate.gameSystemId}</p>
          <p>セル数: {selectedTemplate.cells.length}</p>
          <p>グリッドサイズ: {selectedTemplate.gridSize.rows} × {selectedTemplate.gridSize.cols}</p>
          
          <div style={{ marginTop: '20px' }}>
            <h4>セル一覧:</h4>
            <ul>
              {selectedTemplate.cells.map(cell => (
                <li key={cell.id}>
                  {cell.name} ({cell.type}) - 値: {cell.value || '未設定'}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Container size="lg" py="xl">
      <Stack gap="xl">
        <div>
          <Title order={1} mb="md">
            キャラクターシートエディタ
          </Title>
          <Text c="dimmed">
            汎用的なキャラクターシートテンプレートを作成・編集できます
          </Text>
        </div>

        <Group>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={createNewTemplate}
          >
            新しいテンプレート作成
          </Button>
        </Group>

        <div>
          <Title order={2} mb="md">
            テンプレート一覧
          </Title>
          <Stack gap="md">
            {templates.map(template => (
              <Card key={template.id} shadow="sm" padding="lg" radius="md" withBorder>
                <Group justify="space-between" align="center">
                  <Group align="center" gap="md">
                    <IconTemplate size={32} />
                    <div>
                      <Text fw={500} size="lg">
                        {template.name}
                      </Text>
                      <Text size="sm" c="dimmed">
                        {template.gameSystemId} | {template.cells.length}セル | {template.author}
                      </Text>
                      {template.description && (
                        <Text size="sm" c="dimmed" mt="xs">
                          {template.description}
                        </Text>
                      )}
                    </div>
                  </Group>

                  <Group gap="sm">
                    <Button
                      variant="light"
                      leftSection={<IconEye size={16} />}
                      onClick={() => previewTemplate(template)}
                    >
                      プレビュー
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => editTemplate(template)}
                    >
                      編集
                    </Button>
                  </Group>
                </Group>
              </Card>
            ))}
          </Stack>
        </div>
      </Stack>
    </Container>
  )
}