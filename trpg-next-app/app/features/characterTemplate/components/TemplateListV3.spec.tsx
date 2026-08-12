/** @jest-environment jsdom */

jest.mock('../actions', () => ({
  createCharacter: jest.fn(),
  createTemplate: jest.fn(),
  deleteTemplate: jest.fn(),
  importV2Template: jest.fn()
}))

import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GENERIC_NETWORK_ERROR_MESSAGE } from '../../../lib/api-response.util'
import { createCharacter, createTemplate } from '../actions'
import type { CharacterSheetTemplateSummary } from '../types/v3'
import { TemplateListV3 } from './TemplateListV3'

const mockedCreateCharacter = jest.mocked(createCharacter)
const mockedCreateTemplate = jest.mocked(createTemplate)

const publishedSummary: CharacterSheetTemplateSummary = {
  templateId: 'template-1',
  name: 'テストテンプレート',
  version: '1.0.0',
  schemaVersion: 3,
  tags: [],
  visibility: 'private',
  authorDiscordUserId: 'user-1',
  status: 'published',
  draftRevision: 1
}

afterEach(cleanup)

describe('TemplateListV3', () => {
  it('server error prop なしでも list action のエラーを表示する', async () => {
    mockedCreateTemplate.mockResolvedValue({ error: GENERIC_NETWORK_ERROR_MESSAGE })
    render(
      <MantineProvider>
        <TemplateListV3 summaries={[]} />
      </MantineProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: '新規作成' }))

    expect(await screen.findByText(GENERIC_NETWORK_ERROR_MESSAGE)).toBeTruthy()
    expect(screen.getByText('テンプレートがありません')).toBeTruthy()
  })

  it('キャラクター作成 action のエラーをモーダル内に表示する', async () => {
    mockedCreateCharacter.mockResolvedValue({ error: GENERIC_NETWORK_ERROR_MESSAGE })
    render(
      <MantineProvider>
        <TemplateListV3 summaries={[publishedSummary]} />
      </MantineProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'このテンプレートで作成' }))
    fireEvent.change(await screen.findByRole('textbox', { name: 'キャラクター名' }), {
      target: { value: '探索者' }
    })
    fireEvent.click(screen.getByRole('button', { name: '作成' }))

    expect(await screen.findAllByText(GENERIC_NETWORK_ERROR_MESSAGE)).toHaveLength(2)
  })
})
