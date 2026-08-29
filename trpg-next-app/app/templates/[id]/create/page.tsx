import { Alert, Button, Container, Stack } from '@mantine/core'
import { IconArrowLeft } from '@tabler/icons-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSheetTemplateRevision } from '../../../features/characterTemplate/api/sheetTemplateApi.server'
import { CharacterCreationForm } from '../../../features/characterTemplate/components/CharacterCreationForm'
import { getResponseStatus } from '../../../lib/api-response.util'
import { requireJwt } from '../../../lib/auth-guard.server'

interface CharacterCreatePageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ version?: string | string[] }>
}

function UnavailableTemplate() {
  return (
    <Container size="sm" py="xl">
      <Alert color="yellow" title="このテンプレートからは作成できません">
        <Stack gap="sm">
          公開済みテンプレートのバージョンを選び直してください。
          <Button component={Link} href="/templates" variant="subtle" leftSection={<IconArrowLeft size={16} />}>
            テンプレート一覧へ
          </Button>
        </Stack>
      </Alert>
    </Container>
  )
}

export default async function CharacterCreatePage({ params, searchParams }: CharacterCreatePageProps) {
  await requireJwt()
  const [{ id }, query] = await Promise.all([params, searchParams])
  const version = typeof query.version === 'string' ? query.version : undefined
  if (!version) return <UnavailableTemplate />

  const template = await getSheetTemplateRevision(id, version).catch((error) => {
    const status = getResponseStatus(error)
    if (status === 401 || status === 403) redirect('/login')
    throw error
  })

  if (template.status !== 'published') return <UnavailableTemplate />
  return <CharacterCreationForm template={template} />
}
