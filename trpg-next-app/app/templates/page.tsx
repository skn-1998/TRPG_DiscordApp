import { TemplateListV3 } from '../features/characterTemplate/components/TemplateListV3'
import { requireJwt } from '../lib/auth-guard.server'
import { getTemplateListData } from './getTemplateListData.server'

export default async function TemplatesPage() {
  await requireJwt()

  const templateListData = await getTemplateListData()
  return <TemplateListV3 summaries={templateListData.summaries} />
}
