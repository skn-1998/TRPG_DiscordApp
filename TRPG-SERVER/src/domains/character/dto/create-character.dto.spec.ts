import { BadRequestException, ValidationPipe } from '@nestjs/common'
import { CharacterInputDto } from './create-character.dto'
import { UpdateCharacterDto } from './update-character.dto'

describe('Character AttributeValue HTTP DTO', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true })

  it('CharacterInputDto は values と dice を保持する', async () => {
    const result = await pipe.transform(
      {
        skill: {
          目星: {
            name: '目星',
            values: { base: 25, growth: 15 },
            dice: '1d100<=40'
          }
        }
      },
      { type: 'body', metatype: CharacterInputDto }
    )

    expect(result.skill?.目星).toEqual({
      name: '目星',
      values: { base: 25, growth: 15 },
      dice: '1d100<=40'
    })
  })

  it('dice が文字列でなければ拒否する', async () => {
    await expect(
      pipe.transform(
        { skill: { 目星: { values: { base: 25 }, dice: 100 } } },
        { type: 'body', metatype: CharacterInputDto }
      )
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it.each([
    ['プリミティブ属性', { parameter: { STR: 50 } }],
    ['旧 value 属性', { parameter: { STR: { value: 50 } } }],
    ['非数値の values 要素', { parameter: { STR: { values: { base: '50' } } } }],
    ['配列の values', { parameter: { STR: { values: [50] } } }]
  ])('%s を拒否する', async (_label, input) => {
    await expect(pipe.transform(input, { type: 'body', metatype: CharacterInputDto })).rejects.toBeInstanceOf(
      BadRequestException
    )
  })

  it('UpdateCharacterDto でも同じ AttributeSection 契約を適用する', async () => {
    await expect(
      pipe.transform(
        { status: { HP: { values: { base: Number.POSITIVE_INFINITY } } } },
        { type: 'body', metatype: UpdateCharacterDto }
      )
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('UpdateCharacterDto は辞書キーと dice を変形せず保持する', async () => {
    const result = await pipe.transform(
      { status: { HP: { values: { base: 10, damage: -3 }, dice: '1d6' } } },
      { type: 'body', metatype: UpdateCharacterDto }
    )

    expect(result.status).toEqual({
      HP: { values: { base: 10, damage: -3 }, dice: '1d6' }
    })
  })
})
