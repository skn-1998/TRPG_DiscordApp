import { json, LoaderFunctionArgs, ActionFunctionArgs, redirect } from '@remix-run/node'
import { useActionData, useLoaderData } from '@remix-run/react'
import {
  createSheetTemplate,
  deleteSheetTemplate,
  extractApiErrorMessages,
  getSheetTemplateSummaries,
  normalizeTemplateReferences,
  TemplateListV3
} from '~/features/characterTemplate'
import { getJwtFromRequest } from '~/features/auth/api/auth.service'
import { clearServerRequestContext, setServerRequestContext } from '~/lib/api-client'
import type { CharacterSheetTemplateSummary, CreateSheetTemplateRequest } from '~/features/characterTemplate/types/v3'
import { createCharacterFromTemplate } from '~/features/character/api/character.service'

type TemplatesLoaderData = {
  summaries: CharacterSheetTemplateSummary[]
  error: string | null
}

type TemplatesActionData = { error?: string }

function isTemplateSummary(
  summary: CharacterSheetTemplateSummary | null | undefined
): summary is CharacterSheetTemplateSummary {
  return summary != null
}

export async function loader({ request }: LoaderFunctionArgs) {
  const jwt = getJwtFromRequest(request)
  if (!jwt) throw redirect('/login')

  try {
    setServerRequestContext(request, jwt)
    const summaries = (await getSheetTemplateSummaries(jwt)).filter(isTemplateSummary)
    return json<TemplatesLoaderData>({ summaries, error: null })
  } catch (error) {
    return json<TemplatesLoaderData>({ summaries: [], error: extractApiErrorMessages(error).join(' / ') })
  } finally {
    clearServerRequestContext()
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const jwt = getJwtFromRequest(request)
  if (!jwt) throw redirect('/login')

  const formData = await request.formData()
  const intent = formData.get('intent')

  try {
    setServerRequestContext(request, jwt)

    if (intent === 'create-character') {
      const templateId = String(formData.get('templateId') ?? '')
      const templateVersion = String(formData.get('templateVersion') ?? '')
      const characterName = String(formData.get('characterName') ?? '').trim()
      if (!templateId || !templateVersion || !characterName) {
        return json({ error: 'テンプレートとキャラクター名を入力してください' }, { status: 400 })
      }

      await createCharacterFromTemplate({ templateId, templateVersion, characterName })
      return redirect('/user/character')
    }

    if (intent === 'delete') {
      const templateId = String(formData.get('templateId') ?? '')
      if (!templateId) return json({ error: 'templateId がありません' }, { status: 400 })
      await deleteSheetTemplate(templateId, jwt)
      return redirect('/templates')
    }

    const payload = formData.get('payload')
    const requestBody: CreateSheetTemplateRequest =
      typeof payload === 'string'
        ? (JSON.parse(payload) as CreateSheetTemplateRequest)
        : {
            name: '新規テンプレート',
            version: '0.1.0',
            schemaVersion: 3,
            visibility: 'private',
            tags: [],
            sections: [{ id: 'basic', label: '基本情報', fields: [] }],
            tables: [],
            settings: { rounding: 'floor' }
          }

    const normalizedRequestBody = requestBody.sections
      ? normalizeTemplateReferences({ ...requestBody, sections: requestBody.sections })
      : requestBody

    const created = await createSheetTemplate(normalizedRequestBody, jwt)
    return redirect(`/templates/${created.templateId}/edit`)
  } catch (error) {
    const status = getResponseStatus(error)
    return json(
      { error: extractApiErrorMessages(error).join(' / ') },
      { status: status === 403 || status === 409 || status === 422 ? status : 400 }
    )
  } finally {
    clearServerRequestContext()
  }
}

export default function TemplatesRoute() {
  const { summaries, error } = useLoaderData<typeof loader>()
  const actionData = useActionData<TemplatesActionData>()
  return <TemplateListV3 summaries={summaries} error={error} actionError={actionData?.error} />
}

function getResponseStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'response' in error) {
    return (error as { response?: { status?: number } }).response?.status
  }
  return undefined
}
