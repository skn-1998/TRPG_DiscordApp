import { Alert, Button, Container, Stack, Text } from '@mantine/core'
import { IconArrowLeft } from '@tabler/icons-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCharacter } from '../../../../features/character/api/character.service.server'
import { CharacterSheetEditClient } from '../../../../features/character/components/CharacterSheetEditClient'
import { SheetVisibilityToggle } from '../../../../features/character/components/SheetVisibilityToggle'
import { getSheetTemplateRevision } from '../../../../features/characterTemplate/api/sheetTemplateApi.server'
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

  // 編集面は「最新テンプレート」ではなく character.sheet が pin した版
  // （templateId＋templateVersion）を引く。最新を素引きすると、テンプレートを publish し直した
  // 瞬間に編集画面だけが新版へ勝手に追従し、pin 版で検証する保存経路
  // （server: resolvePinnedRevision）と表示が食い違うため。
  const template = await loadOrRedirectOnAuthFailure(
    getSheetTemplateRevision(character.sheet.templateId, character.sheet.templateVersion)
  )
  return (
    <Stack gap={0}>
      {template.status === 'deprecated' && (
        <Container size="sm" pt="xl" w="100%">
          <Alert color="yellow">このシートは非推奨版のテンプレートに固定されています</Alert>
        </Container>
      )}
      <Container size="sm" pt="xl" w="100%">
        <SheetVisibilityToggle
          characterId={character.characterId}
          initialVisibility={character.sheet.visibility}
        />
      </Container>
      <CharacterSheetEditClient character={character} template={template} />
    </Stack>
  )
}
