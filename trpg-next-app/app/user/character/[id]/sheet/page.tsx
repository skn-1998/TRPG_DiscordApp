import { Alert, Button, Container, Stack, Text } from '@mantine/core'
import { IconArrowLeft } from '@tabler/icons-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCharacter } from '../../../../features/character/api/character.service.server'
import { CharacterSheetEditClient } from '../../../../features/character/components/CharacterSheetEditClient'
import { getSheetTemplate } from '../../../../features/characterTemplate/api/sheetTemplateApi.server'
import { getResponseStatus } from '../../../../lib/api-response.util'
import { requireJwt } from '../../../../lib/auth-guard.server'

interface CharacterSheetPageProps {
  params: Promise<{ id: string }>
}

async function loadOrRedirectOnAuthFailure<T>(request: Promise<T>): Promise<T> {
  try {
    return await request
  } catch (error) {
    const status = getResponseStatus(error)
    if (status === 401 || status === 403) redirect('/login')
    throw error
  }
}

export default async function CharacterSheetPage({ params }: CharacterSheetPageProps) {
  await requireJwt()
  const { id } = await params
  const character = await loadOrRedirectOnAuthFailure(getCharacter(id))

  if (!character.sheet) {
    return (
      <Container size="sm" py="xl">
        <Alert color="yellow">
          <Stack gap="sm">
            <Text>materialized キャラクターではありません</Text>
            <Link href="/user/character">
              <Button component="span" variant="subtle" leftSection={<IconArrowLeft size={16} />}>
                一覧へ
              </Button>
            </Link>
          </Stack>
        </Alert>
      </Container>
    )
  }

  const template = await loadOrRedirectOnAuthFailure(getSheetTemplate(character.sheet.templateId))
  return <CharacterSheetEditClient character={character} template={template} />
}
