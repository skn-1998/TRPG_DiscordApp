'use client'

import { Container, Title } from '@mantine/core'
import { Gallery } from '~/features/characterTemplate'

export default function TemplateGalleryPage() {
  return (
    <Container size="xl">
      <Title order={2} mb="md">
        テンプレートギャラリー
      </Title>
      <Gallery />
    </Container>
  )
}
