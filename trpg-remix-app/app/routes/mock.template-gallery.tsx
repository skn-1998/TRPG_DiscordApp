import { Gallery } from '~/features/characterTemplate'
import { Container, Title } from '@mantine/core'

export default function TemplateGallery() {
  return (
    <Container size="xl">
      <Title order={2} mb="md">
        テンプレートギャラリー
      </Title>
      <Gallery />
    </Container>
  )
}
