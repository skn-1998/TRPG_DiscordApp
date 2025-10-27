import { Editor, Preview } from '~/features/characterTemplate'
import { Container, Grid, Paper, Title } from '@mantine/core'

export default function TemplateEditor() {
  return (
    <Container size="xl">
      <Title order={2} mb="md">
        キャラクターシートテンプレートエディタ
      </Title>
      <Grid>
        <Grid.Col span={6}>
          <Paper p="md" withBorder>
            <Editor />
          </Paper>
        </Grid.Col>
        <Grid.Col span={6}>
          <Paper p="md" withBorder>
            <Preview />
          </Paper>
        </Grid.Col>
      </Grid>
    </Container>
  )
}
