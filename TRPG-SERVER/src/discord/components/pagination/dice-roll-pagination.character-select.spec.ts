import { DiceRollPaginationService, PaginatedDiceRoll } from './dice-roll-pagination.service'

jest.mock('discord.js', () => {
  class MockButtonBuilder {
    data: Record<string, unknown> = {}

    setCustomId(customId: string) {
      this.data.custom_id = customId
      return this
    }

    setLabel(label: string) {
      this.data.label = label
      return this
    }

    setStyle(style: number) {
      this.data.style = style
      return this
    }

    setDisabled(disabled: boolean) {
      this.data.disabled = disabled
      return this
    }

    toJSON() {
      return this.data
    }
  }

  class MockStringSelectMenuBuilder {
    data: Record<string, unknown> = { options: [] }

    setCustomId(customId: string) {
      this.data.custom_id = customId
      return this
    }

    setPlaceholder(placeholder: string) {
      this.data.placeholder = placeholder
      return this
    }

    addOptions(options: unknown[]) {
      this.data.options = options
      return this
    }

    toJSON() {
      return this.data
    }
  }

  class MockActionRowBuilder<T> {
    components: T[] = []

    addComponents(...components: T[]) {
      this.components.push(...components)
      return this
    }

    toJSON() {
      return {
        components: this.components.map((component: any) => component.toJSON())
      }
    }
  }

  return {
    ButtonBuilder: MockButtonBuilder,
    ButtonStyle: {
      Primary: 1,
      Secondary: 2,
      Danger: 4
    },
    StringSelectMenuBuilder: MockStringSelectMenuBuilder,
    ActionRowBuilder: MockActionRowBuilder,
    EmbedBuilder: jest.fn()
  }
})

describe('DiceRollPaginationService character select controls', () => {
  it('adds character select menu when DiceRollChannel has characterIds', async () => {
    const diceRollService = {
      findTextsByChannelId: jest.fn()
    }

    const characterProvider = {
      findCharactersByChannelId: jest.fn().mockResolvedValue([
        { characterId: 'char-1', characterName: '探索者A' },
        { characterId: 'char-2', characterName: '探索者B' }
      ])
    }

    const service = new DiceRollPaginationService(diceRollService as any, characterProvider as any)
    const state: PaginatedDiceRoll = {
      pages: [] as any,
      totalPages: 2,
      currentPage: 1,
      messageId: 'message-1'
    }

    service.savePaginationState('channel-1', 'message-1', state)

    const controls = await service.createPaginationControls('message-1', 'channel-1', 2)
    const json = controls.map((row) => row.toJSON())
    const serialized = JSON.stringify(json)

    expect(serialized).toContain('dice-char-select*message-1*channel-1')
    expect(serialized).toContain('探索者A')
    expect(serialized).toContain('探索者B')
    expect(characterProvider.findCharactersByChannelId).toHaveBeenCalledWith('channel-1')
  })
})
