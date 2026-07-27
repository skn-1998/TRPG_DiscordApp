import { BadRequestException, ValidationPipe } from '@nestjs/common'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { APP_VALIDATION_PIPE_OPTIONS } from '../../core/http/validation-pipe.provider'
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

  // HTTP 経路相当: AppModule の APP_PIPE と同一の共有設定で生成した実 ValidationPipe（whitelist: true）を
  // 通しても、宣言済みの Embed パーツ（footer/image/thumbnail/author/url/timestamp）が剥がされず保持される
  describe('実 ValidationPipe 境界（APP_VALIDATION_PIPE_OPTIONS）', () => {
    const pipe = new ValidationPipe(APP_VALIDATION_PIPE_OPTIONS)

    it('footer 付き embed が通過し、各パーツが保持される', async () => {
      const payload = {
        channelId: 'channel-1',
        embed: {
          title: 'character',
          url: 'https://example.com/character/1',
          timestamp: '2026-07-27T00:00:00.000Z',
          footer: { text: 'via TRPG Bot', iconUrl: 'https://example.com/icon.png' },
          image: { url: 'https://example.com/image.png' },
          thumbnail: { url: 'https://example.com/thumb.png' },
          author: { name: 'GM', url: 'https://example.com/gm', iconUrl: 'https://example.com/gm.png' }
        }
      }

      const result = await pipe.transform(payload, { type: 'body', metatype: SendMessageDto })

      expect(result.embed).toEqual(payload.embed)
    })

    it('footer.text が欠落した embed は BadRequestException で拒否される', async () => {
      const payload = {
        channelId: 'channel-1',
        embed: { title: 'character', footer: { iconUrl: 'https://example.com/icon.png' } }
      }

      await expect(pipe.transform(payload, { type: 'body', metatype: SendMessageDto })).rejects.toBeInstanceOf(
        BadRequestException
      )
    })

    it('ISO 8601 でない timestamp は BadRequestException で拒否される', async () => {
      const payload = { channelId: 'channel-1', embed: { title: 'character', timestamp: 'yesterday' } }

      await expect(pipe.transform(payload, { type: 'body', metatype: SendMessageDto })).rejects.toBeInstanceOf(
        BadRequestException
      )
    })
  })
})
