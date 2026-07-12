import { BadRequestException, ValidationPipe } from '@nestjs/common'
import { SaveCharacterSheetDto } from './character-sheet.dto'

describe('SaveCharacterSheetDto', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true })

  const transform = (changes: unknown[]) =>
    pipe.transform({ baseRevision: 0, changes }, { type: 'body', metatype: SaveCharacterSheetDto })

  it.each([[[null]], [[{}]]])('changes=%p は HTTP 境界で 400 にする', async (changes) => {
    await expect(transform(changes)).rejects.toBeInstanceOf(BadRequestException)
  })

  it('nested path と unknown value を変換後も保持する', async () => {
    await expect(
      transform([{ path: { fieldUid: 'uid-score', partsKey: 'base' }, baseValue: 5, newValue: 6 }])
    ).resolves.toEqual({
      baseRevision: 0,
      changes: [{ path: { fieldUid: 'uid-score', partsKey: 'base' }, baseValue: 5, newValue: 6 }]
    })
  })
})
