/** @jest-environment jsdom */

jest.mock('server-only', () => ({}))

jest.mock('next/navigation', () => ({
  redirect: jest.fn()
}))

jest.mock('../../../../features/character/api/character.service.server', () => ({
  getCharacter: jest.fn()
}))

jest.mock('../../../../features/character/components/CharacterSheetEditClient', () => ({
  CharacterSheetEditClient: () => <div data-testid="sheet-editor" />
}))

jest.mock('../../../../features/character/components/SheetVisibilityToggle', () => ({
  SheetVisibilityToggle: ({
    characterId,
    initialVisibility
  }: {
    characterId: string
    initialVisibility: string
  }) => (
    <div
      data-testid="sheet-visibility-toggle"
      data-character-id={characterId}
      data-visibility={initialVisibility}
    />
  )
}))

jest.mock('../../../../features/characterTemplate/api/sheetTemplateApi.server', () => ({
  getSheetTemplateRevision: jest.fn()
}))

jest.mock('../../../../lib/auth-guard.server', () => ({
  requireJwt: jest.fn()
}))

import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { redirect } from 'next/navigation'
import { GENERIC_DATA_LOAD_ERROR_MESSAGE } from '../../../../components/DataLoadError'
import { getCharacter } from '../../../../features/character/api/character.service.server'
import { getSheetTemplateRevision } from '../../../../features/characterTemplate/api/sheetTemplateApi.server'
import { requireJwt } from '../../../../lib/auth-guard.server'
import CharacterSheetError from './error'
import CharacterSheetLoading from './loading'
import CharacterSheetPage from './page'

const mockedRedirect = jest.mocked(redirect)
const mockedGetCharacter = jest.mocked(getCharacter)
const mockedGetSheetTemplateRevision = jest.mocked(getSheetTemplateRevision)
const mockedRequireJwt = jest.mocked(requireJwt)

afterEach(cleanup)

describe('character sheet route states', () => {
  it('定型エラーと手動再試行を表示し、生のエラー文言は表示しない', () => {
    const reset = jest.fn()
    const retry = jest.fn()
    const rawErrorMessage = 'connect ECONNREFUSED internal-api:3000'
    render(
      <MantineProvider>
        <CharacterSheetError error={new Error(rawErrorMessage)} reset={reset} retry={retry} />
      </MantineProvider>
    )

    expect(screen.getByText(GENERIC_DATA_LOAD_ERROR_MESSAGE)).toBeTruthy()
    expect(document.body.textContent ?? '').not.toContain(rawErrorMessage)
    fireEvent.click(screen.getByRole('button', { name: '再試行' }))
    expect(retry).toHaveBeenCalledTimes(1)
    expect(reset).not.toHaveBeenCalled()
  })

  it('シート編集スケルトンを表示する', () => {
    const { container } = render(
      <MantineProvider>
        <CharacterSheetLoading />
      </MantineProvider>
    )

    expect(container.querySelector('.mantine-Skeleton-root')).toBeTruthy()
  })
})

describe('character sheet page', () => {
  beforeEach(() => {
    mockedRedirect.mockReset()
    mockedGetCharacter.mockReset()
    mockedGetSheetTemplateRevision.mockReset()
    mockedRequireJwt.mockReset().mockResolvedValue(undefined)
  })

  it('getCharacter の 401 は login へ redirect する', async () => {
    const authError = { response: { status: 401 } }
    mockedGetCharacter.mockRejectedValue(authError)

    await expect(
      CharacterSheetPage({ params: Promise.resolve({ id: 'character-1' }) })
    ).rejects.toBe(authError)
    expect(mockedRedirect).toHaveBeenCalledWith('/login')
  })

  it('getSheetTemplateRevision の 403 は login へ redirect する', async () => {
    const authError = { response: { status: 403 } }
    mockedGetCharacter.mockResolvedValue({
      sheet: { templateId: 'template-1', templateVersion: '1.0.0' }
    } as never)
    mockedGetSheetTemplateRevision.mockRejectedValue(authError)

    await expect(
      CharacterSheetPage({ params: Promise.resolve({ id: 'character-1' }) })
    ).rejects.toBe(authError)
    expect(mockedRedirect).toHaveBeenCalledWith('/login')
  })

  // 実物の redirect() は戻らず、NEXT_REDIRECT digest を持つ error を throw して制御を奪う。
  // 何も throw しない mock では redirect 後の経路を通らないため、その error が pin 解決不能の
  // 判定を素通りして呼び出し元まで届くこと（＝注記に吸い込まれて redirect が握り潰されないこと）を
  // 固定できない。ここだけ実物の throw 挙動を再現して、その透過を pin する。
  it('403 の redirect が投げる NEXT_REDIRECT は注記に吸収されず呼び出し元へ透過する', async () => {
    // Next.js 実物の redirect error の形（digest に遷移種別・遷移先・status を載せる）に合わせる。
    const redirectError = Object.assign(new Error('NEXT_REDIRECT'), {
      digest: 'NEXT_REDIRECT;replace;/login;307;'
    })
    mockedRedirect.mockImplementation(() => {
      throw redirectError
    })
    mockedGetCharacter.mockResolvedValue({
      characterId: 'character-1',
      sheet: {
        templateId: 'template-1',
        templateVersion: '1.2.0',
        visibility: 'private'
      }
    } as never)
    mockedGetSheetTemplateRevision.mockRejectedValue({ response: { status: 403 } })

    await expect(
      CharacterSheetPage({ params: Promise.resolve({ id: 'character-1' }) })
    ).rejects.toBe(redirectError)
    expect(mockedRedirect).toHaveBeenCalledWith('/login')
  })

  it('5xx は取得失敗セルへ渡すため throw する', async () => {
    const serverError = { response: { status: 503 } }
    mockedGetCharacter.mockRejectedValue(serverError)

    await expect(
      CharacterSheetPage({ params: Promise.resolve({ id: 'character-1' }) })
    ).rejects.toBe(serverError)
    expect(mockedRedirect).not.toHaveBeenCalled()
  })

  it('公開設定を初期値付きでシート編集 UI の前に配置する', async () => {
    mockedGetCharacter.mockResolvedValue({
      characterId: 'character-1',
      sheet: {
        templateId: 'template-1',
        templateVersion: '1.0.0',
        visibility: 'public'
      }
    } as never)
    mockedGetSheetTemplateRevision.mockResolvedValue({} as never)

    const page = await CharacterSheetPage({ params: Promise.resolve({ id: 'character-1' }) })
    render(<MantineProvider>{page}</MantineProvider>)

    const visibilityToggle = screen.getByTestId('sheet-visibility-toggle')
    const sheetEditor = screen.getByTestId('sheet-editor')
    expect(visibilityToggle.getAttribute('data-character-id')).toBe('character-1')
    expect(visibilityToggle.getAttribute('data-visibility')).toBe('public')
    expect(visibilityToggle.compareDocumentPosition(sheetEditor) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('最新版ではなく sheet が pin した版でテンプレートを取得する', async () => {
    mockedGetCharacter.mockResolvedValue({
      characterId: 'character-1',
      sheet: {
        templateId: 'template-1',
        templateVersion: '1.2.0',
        visibility: 'private'
      }
    } as never)
    mockedGetSheetTemplateRevision.mockResolvedValue({ status: 'published' } as never)

    await CharacterSheetPage({ params: Promise.resolve({ id: 'character-1' }) })

    expect(mockedGetSheetTemplateRevision).toHaveBeenCalledWith('template-1', '1.2.0')
  })

  // 404/409 は pin 版が解決できない行き止まりなので、再試行付きの取得失敗セルではなく
  // route 固有の注記へ落ちること、かつ未解決のテンプレートで編集面を開かせないことを固定する。
  it.each([409, 404])('pin 版を解決できない %i では取得不能注記を出しエディタを描画しない', async (status) => {
    mockedGetCharacter.mockResolvedValue({
      characterId: 'character-1',
      sheet: {
        templateId: 'template-1',
        templateVersion: '1.2.0',
        visibility: 'private'
      }
    } as never)
    mockedGetSheetTemplateRevision.mockRejectedValue({ response: { status } })

    const page = await CharacterSheetPage({ params: Promise.resolve({ id: 'character-1' }) })
    render(<MantineProvider>{page}</MantineProvider>)

    expect(screen.getByText('このシートが固定しているテンプレート版を取得できません')).toBeTruthy()
    expect(screen.queryByTestId('sheet-editor')).toBeNull()
    expect(mockedRedirect).not.toHaveBeenCalled()
  })

  it('pin 版を解決できたときは取得不能注記を出さない', async () => {
    mockedGetCharacter.mockResolvedValue({
      characterId: 'character-1',
      sheet: {
        templateId: 'template-1',
        templateVersion: '1.2.0',
        visibility: 'private'
      }
    } as never)
    mockedGetSheetTemplateRevision.mockResolvedValue({ status: 'published' } as never)

    const page = await CharacterSheetPage({ params: Promise.resolve({ id: 'character-1' }) })
    render(<MantineProvider>{page}</MantineProvider>)

    expect(screen.queryByText('このシートが固定しているテンプレート版を取得できません')).toBeNull()
    expect(screen.getByTestId('sheet-editor')).toBeTruthy()
  })

  // 5xx も通信断も再試行で回復しうるため、取得不能注記へ吸い込まず再試行つきの取得失敗セルへ渡し続ける。
  // 通信断（response を持たず status を読めない素の Error）まで並べるのは、行き止まり判定が
  // 「404/409 または status === undefined」へ緩むと、status 不明の一過性障害まで行き止まり扱いになり
  // 再試行手段のない注記へ落ちてしまうため。status を読めないことは行き止まりの根拠にならない。
  it.each([
    ['5xx', { response: { status: 503 } }],
    ['通信断', new Error('network down')]
  ] as const)('getSheetTemplateRevision の %s は注記にせず取得失敗セルへ渡す', async (_caseName, failure) => {
    mockedGetCharacter.mockResolvedValue({
      characterId: 'character-1',
      sheet: {
        templateId: 'template-1',
        templateVersion: '1.2.0',
        visibility: 'private'
      }
    } as never)
    mockedGetSheetTemplateRevision.mockRejectedValue(failure)

    await expect(
      CharacterSheetPage({ params: Promise.resolve({ id: 'character-1' }) })
    ).rejects.toBe(failure)
    expect(mockedRedirect).not.toHaveBeenCalled()
  })

  it('pin 先が deprecated のときだけ非推奨注記を表示する', async () => {
    mockedGetCharacter.mockResolvedValue({
      characterId: 'character-1',
      sheet: {
        templateId: 'template-1',
        templateVersion: '1.2.0',
        visibility: 'private'
      }
    } as never)
    mockedGetSheetTemplateRevision.mockResolvedValue({ status: 'deprecated' } as never)

    const deprecatedPage = await CharacterSheetPage({ params: Promise.resolve({ id: 'character-1' }) })
    render(<MantineProvider>{deprecatedPage}</MantineProvider>)
    expect(screen.getByText('このシートは非推奨版のテンプレートに固定されています')).toBeTruthy()

    cleanup()
    mockedGetSheetTemplateRevision.mockResolvedValue({ status: 'published' } as never)
    const publishedPage = await CharacterSheetPage({ params: Promise.resolve({ id: 'character-1' }) })
    render(<MantineProvider>{publishedPage}</MantineProvider>)
    expect(screen.queryByText('このシートは非推奨版のテンプレートに固定されています')).toBeNull()
  })
})
