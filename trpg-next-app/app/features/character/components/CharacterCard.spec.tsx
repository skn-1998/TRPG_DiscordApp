/** @jest-environment jsdom */

jest.mock('../../discord/actions', () => ({
  loadDiscordServers: jest.fn(),
  postCharacterToDiscord: jest.fn()
}))

import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { CharacterSummaryWire } from '@trpg/api-contract'
import { CharacterCard } from './CharacterCard'

const visibilityNotice =
  '公開閲覧の提供は準備中。Web では現在自分だけが見られます。Discord hub の表示はチャンネル権限に従います。公開閲覧の開始時には、公開内容の確認をあらためて求めます'

function createCharacter(
  visibility: CharacterSummaryWire['visibility'],
  hub?: CharacterSummaryWire['hub']
): CharacterSummaryWire {
  return {
    characterId: 'character-1',
    characterName: 'テスト探索者',
    gameSystemId: 'Cthulhu7th',
    visibility,
    hub
  }
}

function renderCard(character: CharacterSummaryWire) {
  return render(
    <MantineProvider>
      <CharacterCard character={character} />
    </MantineProvider>
  )
}

afterEach(cleanup)

describe('CharacterCard', () => {
  it.each([
    ['public', '公開'],
    ['private', '非公開']
  ] as const)('visibility %s のバッジを表示する', (visibility, label) => {
    renderCard(createCharacter(visibility))

    expect(screen.getByText(label, { exact: true })).toBeTruthy()
  })

  it('visibility バッジの Tooltip に正本固定の注記全文を表示する', async () => {
    renderCard(createCharacter('public'))
    const visibilityBadge = screen.getByText('公開', { exact: true }).closest('.mantine-Badge-root')
    if (!visibilityBadge) throw new Error('visibility バッジが見つかりません')

    fireEvent.mouseEnter(visibilityBadge)

    expect(await screen.findByText(visibilityNotice, { exact: true })).toBeTruthy()
  })

  it('hub がなくてもシート編集導線と Discord ActionIcon の両方を表示する', () => {
    renderCard(createCharacter('private'))

    const editLink = screen.getByRole('link', { name: 'シート編集' })
    expect(editLink.getAttribute('href')).toBe('/user/character/character-1/sheet')
    expect(screen.getByRole('button', { name: 'Discord サーバーに追加' })).toBeTruthy()
  })

  it.each(['private', 'public'] as const)(
    'Discord ActionIcon は visibility=%s に関係なく表示する',
    (visibility) => {
      renderCard(createCharacter(visibility, { status: 'active' }))

      expect(screen.getByRole('button', { name: 'Discord サーバーに追加' })).toBeTruthy()
    }
  )
})
