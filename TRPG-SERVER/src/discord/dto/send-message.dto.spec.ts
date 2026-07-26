import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { SendMessageDto } from './send-message.dto'

describe('SendMessageDto', () => {
  it('16進文字列のEmbed色をDiscord用の数値へ正規化する', async () => {
    const dto = plainToInstance(SendMessageDto, {
      channelId: 'channel-1',
      embed: { title: 'character', color: '#0099ff' }
    })

    const errors = await validate(dto)

    expect(errors).toHaveLength(0)
    expect(dto.embed?.color).toBe(0x0099ff)
  })

  it.each([
    ['3桁の16進文字列', '#fff'],
    ['16進数でない文字列', '#GGGGGG'],
    ['負の整数', -1],
    ['上限を超える整数', 0x1000000],
    ['小数', 1.5]
  ])('%s のEmbed色を拒否する', async (_label, color) => {
    const dto = plainToInstance(SendMessageDto, {
      channelId: 'channel-1',
      embed: { title: 'character', color }
    })

    const errors = await validate(dto)

    expect(errors).not.toHaveLength(0)
  })

  it.each([0, 0xffffff])('境界値 %i のEmbed色を受理する', async (color) => {
    const dto = plainToInstance(SendMessageDto, {
      channelId: 'channel-1',
      embed: { title: 'character', color }
    })

    const errors = await validate(dto)

    expect(errors).toHaveLength(0)
    expect(dto.embed?.color).toBe(color)
  })
})
