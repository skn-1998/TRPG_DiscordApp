// default_member_permissions の外部契約を検証するため、global mock ではなく実 builder を使う。
jest.mock('discord.js', () => jest.requireActual('discord.js'))

import { PermissionsBitField } from 'discord.js'
import { SelectGameSystemService } from './select-game-system.service'

describe('SelectGameSystemService', () => {
  it('create-dice-channel の既定メンバー権限を ManageChannels に限定する', () => {
    const service = new SelectGameSystemService({} as never, {} as never)

    expect(service.data.toJSON().default_member_permissions).toBe(PermissionsBitField.Flags.ManageChannels.toString())
  })
})
