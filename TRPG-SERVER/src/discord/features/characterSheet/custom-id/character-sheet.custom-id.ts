const CHANNEL_ID_SOURCE = '[0-9]+'
const PALETTE_KEY_SOURCE = '[a-z0-9]+'
const DECIMAL_DELTA_SOURCE = '-?(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?'

export const ROLL_PALETTE_CUSTOM_ID_PATTERN = new RegExp(`^roll_(${CHANNEL_ID_SOURCE})_(${PALETTE_KEY_SOURCE})$`)

export const RESOURCE_DELTA_CUSTOM_ID_PATTERN = new RegExp(
  `^res_(${CHANNEL_ID_SOURCE})_(${PALETTE_KEY_SOURCE})_(${DECIMAL_DELTA_SOURCE})$`
)

/** v1.x で kind:check / kind:declare に割り当てる予約 prefix。 */
export const CHECK_CUSTOM_ID_RESERVED_PREFIX = 'chk_'
export const DECLARE_CUSTOM_ID_RESERVED_PREFIX = 'dec_'

export interface ParsedRollPaletteCustomId {
  channelId: string
  key: string
}

export interface ParsedResourceDeltaCustomId extends ParsedRollPaletteCustomId {
  delta: number
}

function invalidCustomIdPart(name: string): never {
  throw new Error(`invalid ${name} for character-sheet customId`)
}

export const RollPaletteCustomId = {
  pattern: ROLL_PALETTE_CUSTOM_ID_PATTERN,

  create(channelId: string, key: string): string {
    const customId = `roll_${channelId}_${key}`
    if (!ROLL_PALETTE_CUSTOM_ID_PATTERN.test(customId)) invalidCustomIdPart('channelId or key')
    return customId
  },

  parse(customId: string): ParsedRollPaletteCustomId | null {
    const match = ROLL_PALETTE_CUSTOM_ID_PATTERN.exec(customId)
    if (match === null) return null
    return { channelId: match[1], key: match[2] }
  }
} as const

export const ResourceDeltaCustomId = {
  pattern: RESOURCE_DELTA_CUSTOM_ID_PATTERN,

  create(channelId: string, key: string, delta: number): string {
    if (!Number.isFinite(delta)) invalidCustomIdPart('delta')
    const normalizedDelta = Object.is(delta, -0) ? 0 : delta
    const customId = `res_${channelId}_${key}_${normalizedDelta}`
    if (!RESOURCE_DELTA_CUSTOM_ID_PATTERN.test(customId)) invalidCustomIdPart('channelId, key, or delta')
    return customId
  },

  parse(customId: string): ParsedResourceDeltaCustomId | null {
    const match = RESOURCE_DELTA_CUSTOM_ID_PATTERN.exec(customId)
    if (match === null) return null
    const delta = Number(match[3])
    if (!Number.isFinite(delta)) return null
    return { channelId: match[1], key: match[2], delta }
  }
} as const
