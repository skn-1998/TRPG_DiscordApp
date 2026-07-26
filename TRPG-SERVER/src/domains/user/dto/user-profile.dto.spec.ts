import { BadRequestException, ValidationPipe } from '@nestjs/common'
import { UserCharacterParamDto } from './create-user.dto'
import { CreateUserProfileDto, UpdateUserProfileDto } from './user-profile.dto'

describe('User profile HTTP DTO', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })

  it.each(['discordUserId', 'characterIds', 'discordAccessToken', 'discordRefreshToken'])(
    'createで管理対象外の%sを拒否する',
    async (field) => {
      await expect(
        pipe.transform({ name: 'User', [field]: 'client-controlled' }, { type: 'body', metatype: CreateUserProfileDto })
      ).rejects.toBeInstanceOf(BadRequestException)
    }
  )

  it('updateは公開プロフィール項目だけを受理する', async () => {
    const result = await pipe.transform(
      { name: 'Updated', avatarHash: 'avatar' },
      { type: 'body', metatype: UpdateUserProfileDto }
    )

    expect(result).toEqual({ name: 'Updated', avatarHash: 'avatar' })
  })

  it('UserCharacterParamDtoは両方のpath IDを検証する', async () => {
    await expect(
      pipe.transform(
        { discordUserId: '', characterId: 'character-1' },
        { type: 'param', metatype: UserCharacterParamDto }
      )
    ).rejects.toBeInstanceOf(BadRequestException)

    await expect(
      pipe.transform(
        { discordUserId: 'user-1', characterId: 'character-1' },
        { type: 'param', metatype: UserCharacterParamDto }
      )
    ).resolves.toEqual({ discordUserId: 'user-1', characterId: 'character-1' })
  })
})
