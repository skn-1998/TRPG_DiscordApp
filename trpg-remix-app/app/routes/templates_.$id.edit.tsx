import { json, LoaderFunctionArgs, ActionFunctionArgs, redirect } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import {
  extractApiErrorMessages,
  getSheetTemplate,
  publishSheetTemplate,
  TemplateEditorV3,
  updateSheetTemplate
} from '~/features/characterTemplate'
import { getJwtFromRequest } from '~/features/auth/api/auth.service'
import { clearServerRequestContext, setServerRequestContext } from '~/lib/api-client'
import type { CharacterSheetTemplateEntity, UpdateSheetTemplateRequest } from '~/features/characterTemplate/types/v3'

export async function loader({ request, params }: LoaderFunctionArgs) {
  const jwt = getJwtFromRequest(request)
  if (!jwt) throw redirect('/login')
  if (!params.id) throw redirect('/templates')

  try {
    setServerRequestContext(request, jwt)
    const template = await getSheetTemplate(params.id, jwt)
    return json({ template })
  } finally {
    clearServerRequestContext()
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  const jwt = getJwtFromRequest(request)
  if (!jwt) throw redirect('/login')
  if (!params.id) return json({ ok: false, messages: ['templateId がありません'] }, { status: 400 })

  const formData = await request.formData()
  const intent = String(formData.get('intent') ?? '')
  const rawPayload = formData.get('payload')

  if (typeof rawPayload !== 'string') {
    return json({ ok: false, intent, messages: ['payload がありません'] }, { status: 400 })
  }

  try {
    setServerRequestContext(request, jwt)
    const payload = JSON.parse(rawPayload) as CharacterSheetTemplateEntity
    const updateRequest = toUpdateRequest(payload)
    const updated = await updateSheetTemplate(params.id, updateRequest, jwt)

    if (intent === 'publish') {
      const published = await publishSheetTemplate(params.id, jwt)
      return json({ ok: true, intent, template: published })
    }

    return json({ ok: true, intent, template: updated })
  } catch (error) {
    const status = getResponseStatus(error)
    return json(
      {
        ok: false,
        intent,
        conflict: status === 409,
        messages: extractApiErrorMessages(error)
      },
      { status: status === 409 ? 409 : 400 }
    )
  } finally {
    clearServerRequestContext()
  }
}

export default function TemplateEditRoute() {
  const { template } = useLoaderData<typeof loader>()
  return <TemplateEditorV3 initialTemplate={template} />
}

function toUpdateRequest(template: CharacterSheetTemplateEntity): UpdateSheetTemplateRequest {
  return {
    draftRevision: template.draftRevision,
    name: template.name,
    version: template.version,
    schemaVersion: 3,
    gameSystemId: template.gameSystemId,
    tags: template.tags,
    visibility: template.visibility,
    forkedFrom: template.forkedFrom,
    license: template.license,
    sections: template.sections,
    tables: template.tables,
    settings: template.settings
  }
}

function getResponseStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'response' in error) {
    return (error as { response?: { status?: number } }).response?.status
  }
  return undefined
}
