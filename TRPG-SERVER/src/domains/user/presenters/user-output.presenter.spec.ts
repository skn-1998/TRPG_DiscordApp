import { User } from '../models/user.model'
import { toUserOutput } from './user-output.presenter'

describe('toUserOutput', () => {
  it('OAuth token項目を公開せずcharacterIdsをコピーする', () => {
    const user: User = {
      discordUserId: 'user-1',
      name: 'User',
      characterIds: ['character-1'],
      discordAccessToken: 'encrypted-access',
      discordRefreshToken: 'encrypted-refresh',
      discordTokenExpiresAt: new Date('2030-01-01T00:00:00.000Z'),
      discordTokenScope: 'identify guilds'
    }

    const output = toUserOutput(user)

    expect(output).toEqual({
      discordUserId: 'user-1',
      name: 'User',
      characterIds: ['character-1']
    })
    expect(output).not.toHaveProperty('discordAccessToken')
    expect(output).not.toHaveProperty('discordRefreshToken')
    expect(output.characterIds).not.toBe(user.characterIds)
  })
})
