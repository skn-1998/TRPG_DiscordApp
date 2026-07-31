export const ROLL_PALETTE_CUSTOM_ID_PREFIX = 'roll_'
export const RESOURCE_DELTA_CUSTOM_ID_PREFIX = 'res_'
export const HUB_GROUP_SELECT_CUSTOM_ID_PREFIX = 'hub_group_'
export const HUB_PANEL_CUSTOM_ID_PREFIX = 'hub_panel_'
export const HUB_GROUP_BROWSER_CUSTOM_ID_PREFIX = 'hub_groups_'

export const CUSTOM_ID_CHANNEL_SOURCE = '[0-9]+'
export const CUSTOM_ID_SAFE_TOKEN_SOURCE = '[a-z0-9]+'
export const CUSTOM_ID_PALETTE_KEY_SOURCE = CUSTOM_ID_SAFE_TOKEN_SOURCE
export const CANONICAL_RESOURCE_DELTA_SOURCE = '-?(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?'
export const CUSTOM_ID_GROUP_SOURCE = CUSTOM_ID_SAFE_TOKEN_SOURCE
export const CUSTOM_ID_PAGE_SOURCE = '[1-9][0-9]*'

export const CANONICAL_RESOURCE_DELTA_PATTERN = new RegExp(`^${CANONICAL_RESOURCE_DELTA_SOURCE}$`)
export const ROLL_PALETTE_CUSTOM_ID_PATTERN = new RegExp(
  `^${ROLL_PALETTE_CUSTOM_ID_PREFIX}(${CUSTOM_ID_CHANNEL_SOURCE})_(${CUSTOM_ID_PALETTE_KEY_SOURCE})$`
)
export const RESOURCE_DELTA_CUSTOM_ID_PATTERN = new RegExp(
  `^${RESOURCE_DELTA_CUSTOM_ID_PREFIX}(${CUSTOM_ID_CHANNEL_SOURCE})_(${CUSTOM_ID_PALETTE_KEY_SOURCE})_(${CANONICAL_RESOURCE_DELTA_SOURCE})$`
)
export const HUB_GROUP_SELECT_CUSTOM_ID_PATTERN = new RegExp(
  `^${HUB_GROUP_SELECT_CUSTOM_ID_PREFIX}(${CUSTOM_ID_CHANNEL_SOURCE})$`
)
export const HUB_PANEL_CUSTOM_ID_PATTERN = new RegExp(
  `^${HUB_PANEL_CUSTOM_ID_PREFIX}(${CUSTOM_ID_CHANNEL_SOURCE})_(${CUSTOM_ID_GROUP_SOURCE})_(${CUSTOM_ID_PAGE_SOURCE})$`
)
export const HUB_GROUP_BROWSER_CUSTOM_ID_PATTERN = new RegExp(
  `^${HUB_GROUP_BROWSER_CUSTOM_ID_PREFIX}(${CUSTOM_ID_CHANNEL_SOURCE})_(${CUSTOM_ID_PAGE_SOURCE})$`
)
export const HUB_GROUP_MENU_CUSTOM_ID_PATTERN = new RegExp(
  `^(?:${HUB_GROUP_SELECT_CUSTOM_ID_PREFIX}(${CUSTOM_ID_CHANNEL_SOURCE})|${HUB_GROUP_BROWSER_CUSTOM_ID_PREFIX}(${CUSTOM_ID_CHANNEL_SOURCE})_(${CUSTOM_ID_PAGE_SOURCE}))$`
)

/**
 * resource delta を customId 契約の通常10進表現へ変換する。
 * String() が指数表記を返す値と -0 は、表示できても parser と往復できないため拒否する。
 */
export function canonicalizeResourceDelta(delta: number): string | null {
  if (!Number.isFinite(delta) || Object.is(delta, -0)) return null
  const value = String(delta)
  return CANONICAL_RESOURCE_DELTA_PATTERN.test(value) ? value : null
}

export function createRollPaletteCustomId(channelId: string, key: string): string | null {
  const customId = `${ROLL_PALETTE_CUSTOM_ID_PREFIX}${channelId}_${key}`
  return ROLL_PALETTE_CUSTOM_ID_PATTERN.test(customId) ? customId : null
}

export function createResourceDeltaCustomId(channelId: string, key: string, delta: number): string | null {
  const canonicalDelta = canonicalizeResourceDelta(delta)
  if (canonicalDelta === null) return null
  const customId = `${RESOURCE_DELTA_CUSTOM_ID_PREFIX}${channelId}_${key}_${canonicalDelta}`
  return RESOURCE_DELTA_CUSTOM_ID_PATTERN.test(customId) ? customId : null
}

export function createHubGroupSelectCustomId(channelId: string): string | null {
  const customId = `${HUB_GROUP_SELECT_CUSTOM_ID_PREFIX}${channelId}`
  return HUB_GROUP_SELECT_CUSTOM_ID_PATTERN.test(customId) ? customId : null
}

export function createHubPanelCustomId(channelId: string, groupId: string, page: number): string | null {
  if (!Number.isSafeInteger(page) || page < 1) return null
  const customId = `${HUB_PANEL_CUSTOM_ID_PREFIX}${channelId}_${groupId}_${page}`
  return HUB_PANEL_CUSTOM_ID_PATTERN.test(customId) ? customId : null
}

export function createHubGroupBrowserCustomId(channelId: string, page: number): string | null {
  if (!Number.isSafeInteger(page) || page < 1) return null
  const customId = `${HUB_GROUP_BROWSER_CUSTOM_ID_PREFIX}${channelId}_${page}`
  return HUB_GROUP_BROWSER_CUSTOM_ID_PATTERN.test(customId) ? customId : null
}
