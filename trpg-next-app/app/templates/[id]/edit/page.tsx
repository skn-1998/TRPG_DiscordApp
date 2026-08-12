import { redirect } from 'next/navigation'
import { TemplateEditorV3 } from '../../../features/characterTemplate/components/TemplateEditorV3'
import { getSheetTemplate } from '../../../features/characterTemplate/api/sheetTemplateApi.server'
import { getResponseStatus } from '../../../lib/api-response.util'
import { requireJwt } from '../../../lib/auth-guard.server'

interface TemplateEditPageProps {
  params: Promise<{ id: string }>
}

export default async function TemplateEditPage({ params }: TemplateEditPageProps) {
  await requireJwt()
  const { id } = await params
  const template = await getSheetTemplate(id).catch((error) => {
    const status = getResponseStatus(error)
    if (status === 401 || status === 403) redirect('/login')
    throw error
  })

  return <TemplateEditorV3 initialTemplate={template} />
}
