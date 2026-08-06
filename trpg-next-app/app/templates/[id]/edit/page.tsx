import { TemplateEditorV3 } from '../../../features/characterTemplate/components/TemplateEditorV3'
import { getSheetTemplate } from '../../../features/characterTemplate/api/sheetTemplateApi.server'
import { requireJwt } from '../../../lib/auth-guard.server'

interface TemplateEditPageProps {
  params: Promise<{ id: string }>
}

export default async function TemplateEditPage({ params }: TemplateEditPageProps) {
  await requireJwt()
  const { id } = await params
  const template = await getSheetTemplate(id)
  return <TemplateEditorV3 initialTemplate={template} />
}
