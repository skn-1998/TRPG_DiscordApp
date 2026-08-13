import { BadRequestException, ValidationPipe } from '@nestjs/common'
import { APP_VALIDATION_PIPE_OPTIONS } from '../../../core/http/validation-pipe.provider'
import { SaveCharacterSheetDto } from './character-sheet.dto'

describe('SaveCharacterSheetDto', () => {
  const pipe = new ValidationPipe(APP_VALIDATION_PIPE_OPTIONS)

  const transform = (changes: unknown[]) =>
    pipe.transform({ baseRevision: 0, changes }, { type: 'body', metatype: SaveCharacterSheetDto })

  it.each([[[null]], [[{}]]])('changes=%p は HTTP 境界で 400 にする', async (changes) => {
    await expect(transform(changes)).rejects.toBeInstanceOf(BadRequestException)
  })

  // JSON で欠落する undefined を、未存在 path に対する CAS の期待値として service まで届ける。
  it('path/newValue があれば baseValue の欠落を受理する', async () => {
    await expect(transform([{ path: { fieldUid: 'uid-score', partsKey: 'career' }, newValue: 1 }])).resolves.toEqual({
      baseRevision: 0,
      changes: [{ path: { fieldUid: 'uid-score', partsKey: 'career' }, newValue: 1 }]
    })
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
