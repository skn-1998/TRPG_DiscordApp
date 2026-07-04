'use server'

export interface ActionTestState {
  message: string
}

export async function submitActionTest(
  _previousState: ActionTestState,
  formData: FormData
): Promise<ActionTestState> {
  return { message: String(formData.get('message') || '') }
}
