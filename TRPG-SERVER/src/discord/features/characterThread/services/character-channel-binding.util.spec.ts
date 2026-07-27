import {
  CHARACTER_CHANNEL_BINDING_REQUIRED_MESSAGE,
  isMaterializedWithoutChannel
} from './character-channel-binding.util'

type CharacterChannelBindingInput = Parameters<typeof isMaterializedWithoutChannel>[0]

const materializedSheet = {
  templateId: 'template-1',
  templateVersion: '1.0.0',
  revision: 1,
  values: {}
}

const character = (overrides: Partial<CharacterChannelBindingInput> = {}): CharacterChannelBindingInput => ({
  discordChannelId: '',
  ...overrides
})

describe('character-channel-binding.util', () => {
  it('materialized かつ discordChannelId 未紐付けを拒否対象と判定する', () => {
    expect(
      isMaterializedWithoutChannel(
        character({
          sheet: materializedSheet
        })
      )
    ).toBe(true)
  })

  it.each([
    ['紐付け済みの materialized', character({ discordChannelId: 'channel-1', sheet: materializedSheet })],
    ['未紐付けの legacy-unpinned', character()],
    [
      '未紐付けの legacy-pinned',
      character({
        templatePin: {
          templateId: 'template-1',
          templateVersion: '1.0.0',
          pinnedBy: 'user-1'
        }
      })
    ],
    [
      '空白のみの channelId を持つ materialized（「非空」扱い＝拒否せず projection warning に委ねる）',
      character({ discordChannelId: ' ', sheet: materializedSheet })
    ]
  ])('%s は拒否対象にしない', (_caseName, input) => {
    expect(isMaterializedWithoutChannel(input)).toBe(false)
  })

  it('拒否文言を固定する', () => {
    expect(CHARACTER_CHANNEL_BINDING_REQUIRED_MESSAGE).toBe(
      '先にキャラクターのチャンネルを開設してください（/post-character）。'
    )
  })
})
