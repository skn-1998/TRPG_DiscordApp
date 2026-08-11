import {
  BUTTONS_PER_ROW,
  DISCORD_BUTTON_LABEL_MAX_LENGTH,
  DISCORD_CHANNEL_ID_PATTERN,
  DISCORD_CUSTOM_ID_MAX_LENGTH,
  DISCORD_EMBED_DESCRIPTION_MAX_LENGTH,
  DISCORD_EMBED_FIELD_NAME_MAX_LENGTH,
  DISCORD_EMBED_FIELD_VALUE_MAX_LENGTH,
  DISCORD_EMBED_FOOTER_TEXT_MAX_LENGTH,
  DISCORD_EMBED_MAX_FIELDS,
  DISCORD_EMBED_TITLE_MAX_LENGTH,
  DISCORD_EMBED_TOTAL_MAX_LENGTH,
  DISCORD_SELECT_LABEL_MAX_LENGTH,
  GROUP_BROWSER_PAGE_SIZE,
  GROUP_SELECT_MORE_VALUE,
  GROUP_SELECT_VISIBLE_LIMIT,
  HUB_GROUP_ID_MAX_LENGTH,
  PALETTE_SOFT_CAP,
  PANEL_ACTIONS_PER_PAGE,
  PINNED_BUTTON_LIMIT,
  SAFE_PROJECTION_ID_PATTERN,
  TEMPLATE_NAME_DISPLAY_MAX_LENGTH,
} from './constants'
import {
  CUSTOM_ID_SAFE_TOKEN_SOURCE,
  canonicalizeResourceDelta,
  createHubGroupBrowserCustomId,
  createHubGroupSelectCustomId,
  createHubPanelCustomId,
  createResourceDeltaCustomId,
  createRollPaletteCustomId,
} from './custom-id'
import { stripMatchingPaletteValueSuffix } from './palette-label'
import type {
  DiscordButtonModel,
  DiscordButtonRowModel,
  DiscordEmbedModel,
  DiscordGroupSelectModel,
  DiscordProjectionInput,
  DiscordProjectionViewModel,
  DiscordSelectOptionModel,
  EphemeralPanelInput,
  EphemeralPanelViewModel,
  GroupBrowserInput,
  GroupBrowserViewModel,
  PageNavigationModel,
  ProjectionPaletteEntry,
  ProjectionWarning,
} from './types'

interface Result<T> {
  value: T
  warnings: ProjectionWarning[]
}

const RESOURCE_VALUE_PLACEHOLDER = '—'

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  if (maxLength <= 1) return value.slice(0, maxLength)
  return `${value.slice(0, maxLength - 1)}…`
}

function warnForTruncation(
  warnings: ProjectionWarning[],
  original: string,
  truncated: string,
  path: string
): void {
  if (original === truncated) return
  warnings.push({ code: 'label-truncated', message: `${path} was truncated to fit Discord limits`, path })
}

function labelOrFallback(
  value: string,
  fallback: string,
  path: string,
  warnings: ProjectionWarning[]
): string {
  if (value.trim().length > 0) return value
  warnings.push({
    code: 'empty-label-fallback',
    message: `${path} was empty; ${JSON.stringify(fallback)} is displayed instead`,
    path,
  })
  return fallback
}

function isRenderableCustomIdPart(value: string): boolean {
  return SAFE_PROJECTION_ID_PATTERN.test(value)
}

function isRenderableResourceDelta(canonicalDelta: string | null): canonicalDelta is string {
  return canonicalDelta !== null
}

function validateIdPart(value: string, path: string, warnings: ProjectionWarning[]): boolean {
  if (isRenderableCustomIdPart(value)) return true
  warnings.push({
    code: 'invalid-custom-id-part',
    message: `${path} must match ${CUSTOM_ID_SAFE_TOKEN_SOURCE}; the related component was omitted`,
    path,
  })
  return false
}

function validateChannelId(channelId: string, warnings: ProjectionWarning[]): boolean {
  if (DISCORD_CHANNEL_ID_PATTERN.test(channelId)) return true
  warnings.push({
    code: 'invalid-custom-id-part',
    message: 'channelId must be a Discord numeric id; interactive components were omitted',
    path: 'channelId',
  })
  return false
}

function acceptCustomId(customId: string, path: string, warnings: ProjectionWarning[]): boolean {
  if (customId.length <= DISCORD_CUSTOM_ID_MAX_LENGTH) return true
  warnings.push({
    code: 'custom-id-budget-exceeded',
    message: `${path} exceeds the Discord ${DISCORD_CUSTOM_ID_MAX_LENGTH} character customId limit; the related component was omitted`,
    path,
  })
  return false
}

function acceptGeneratedCustomId(
  customId: string | null,
  path: string,
  warnings: ProjectionWarning[]
): customId is string {
  if (customId !== null) return acceptCustomId(customId, path, warnings)
  warnings.push({
    code: 'invalid-custom-id-part',
    message: `${path} cannot be represented by the customId contract; the related component was omitted`,
    path,
  })
  return false
}

interface GroupReference {
  source: string
  id: string
  label: string
}

function hashGroupId(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `g${(hash >>> 0).toString(36)}`
}

function countGroupActions(palette: readonly ProjectionPaletteEntry[], group: string): number {
  return palette.reduce((count, entry) => {
    if (entry.group !== group || !isRenderableCustomIdPart(entry.key)) return count
    if (entry.kind === 'roll') return count + 1
    return count + entry.deltas.filter((delta) => isRenderableResourceDelta(canonicalizeResourceDelta(delta))).length
  }, 0)
}

function createGroupReferences(
  palette: readonly ProjectionPaletteEntry[],
  warnings: ProjectionWarning[]
): GroupReference[] {
  const sources = [...new Set(palette.map((entry) => entry.group))].filter((source) => {
    if (countGroupActions(palette, source) > 0) return true
    const firstEntry = palette.find((entry) => entry.group === source)
    const fallback = firstEntry?.fieldRef.uid.split('.')[0] || firstEntry?.key || 'group'
    warnings.push({
      code: 'empty-group-omitted',
      message: `group ${JSON.stringify(source || fallback)} has no palette actions and was omitted`,
      path: `group.${source || fallback}`,
    })
    return false
  })
  const isReusableGroupId = (source: string): boolean =>
    SAFE_PROJECTION_ID_PATTERN.test(source) && source.length <= HUB_GROUP_ID_MAX_LENGTH
  const reserved = new Set(sources.filter(isReusableGroupId))
  const assigned = new Map<string, string>()
  for (const source of sources.filter((candidate) => !isReusableGroupId(candidate)).sort()) {
    const base = hashGroupId(source)
    let id = base
    let suffix = 0
    while (reserved.has(id)) {
      suffix += 1
      id = `${base}${suffix.toString(36)}`
    }
    reserved.add(id)
    assigned.set(source, id)
  }
  return sources.map((source) => {
    const firstEntry = palette.find((entry) => entry.group === source)
    const fallback = firstEntry?.fieldRef.uid.split('.')[0] || firstEntry?.key || 'group'
    const label = labelOrFallback(source, fallback, `group.${source || fallback}.label`, warnings)
    if (isReusableGroupId(source)) return { source, id: source, label }
    const id = assigned.get(source) as string
    warnings.push({
      code: 'group-id-normalized',
      message: `group ${JSON.stringify(source)} uses the customId-safe key ${id}`,
      path: `group.${source || fallback}`,
    })
    return { source, id, label }
  })
}

function splitRows(buttons: readonly DiscordButtonModel[]): DiscordButtonRowModel[] {
  const rows: DiscordButtonRowModel[] = []
  for (let index = 0; index < buttons.length; index += BUTTONS_PER_ROW) {
    rows.push(buttons.slice(index, index + BUTTONS_PER_ROW))
  }
  return rows
}

function formatResourceValue(value: unknown): string {
  if (value === undefined || value === null) return RESOURCE_VALUE_PLACEHOLDER
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : RESOURCE_VALUE_PLACEHOLDER
  if (typeof value === 'string' || typeof value === 'boolean') return String(value)
  if (typeof value !== 'object') return RESOURCE_VALUE_PLACEHOLDER

  const record = value as Record<string, unknown>
  const candidate =
    typeof record.values === 'object' && record.values !== null
      ? (record.values as Record<string, unknown>)
      : typeof record.parts === 'object' && record.parts !== null
        ? (record.parts as Record<string, unknown>)
      : record
  const parts = Object.values(candidate).filter(
    (part): part is number => typeof part === 'number' && Number.isFinite(part)
  )
  return parts.length > 0
    ? String(parts.reduce((sum, part) => sum + part, 0))
    : RESOURCE_VALUE_PLACEHOLDER
}

function buildEmbed(input: DiscordProjectionInput): Result<DiscordEmbedModel> {
  const warnings: ProjectionWarning[] = []
  const title = truncate(input.characterName, DISCORD_EMBED_TITLE_MAX_LENGTH)
  if (title !== input.characterName) {
    warnings.push({ code: 'embed-truncated', message: 'characterName was truncated for the hub embed', path: 'characterName' })
  }

  let description = truncate(
    input.templateName
      ? `${truncate(input.templateName, TEMPLATE_NAME_DISPLAY_MAX_LENGTH)} · v${input.templateVersion}`
      : `Template v${input.templateVersion}`,
    DISCORD_EMBED_DESCRIPTION_MAX_LENGTH
  )
  const footer = input.opId
    ? { text: truncate(`opId:${input.opId}`, DISCORD_EMBED_FOOTER_TEXT_MAX_LENGTH) }
    : undefined
  const baseBudget = DISCORD_EMBED_TOTAL_MAX_LENGTH - title.length - (footer?.text.length ?? 0)
  if (description.length > baseBudget) {
    description = truncate(description, Math.max(0, baseBudget))
    warnings.push({
      code: 'embed-truncated',
      message: `embed description was truncated to fit the Discord ${DISCORD_EMBED_TOTAL_MAX_LENGTH} character total limit`,
      path: 'templateVersion',
    })
  }
  const resourceEntries = input.palette.filter((entry) => entry.kind === 'resource')
  const includedResources = resourceEntries.slice(0, DISCORD_EMBED_MAX_FIELDS)
  if (resourceEntries.length > DISCORD_EMBED_MAX_FIELDS) {
    warnings.push({
      code: 'embed-truncated',
      message: `resource fields were truncated from ${resourceEntries.length} to ${DISCORD_EMBED_MAX_FIELDS}`,
      path: 'palette',
    })
  }
  const candidates = includedResources.map((entry) => {
    const rawValue = formatResourceValue(input.resourceValues?.[entry.fieldRef.uid])
    const displayLabel = labelOrFallback(
      entry.label,
      entry.fieldRef.uid || entry.key,
      `palette.${entry.key}.label`,
      warnings
    )
    const rawName = stripMatchingPaletteValueSuffix(displayLabel, rawValue)
    const name = truncate(rawName, DISCORD_EMBED_FIELD_NAME_MAX_LENGTH)
    const value = truncate(rawValue, DISCORD_EMBED_FIELD_VALUE_MAX_LENGTH)
    if (name !== rawName || value !== rawValue) {
      warnings.push({ code: 'embed-truncated', message: `resource ${entry.key} was truncated for the hub embed`, path: `palette.${entry.key}` })
    }
    return { name, value, inline: true }
  })
  const fields: typeof candidates = []
  let usedCharacters = title.length + description.length + (footer?.text.length ?? 0)
  for (const field of candidates) {
    const fieldCharacters = field.name.length + field.value.length
    if (usedCharacters + fieldCharacters > DISCORD_EMBED_TOTAL_MAX_LENGTH) {
      warnings.push({
        code: 'embed-truncated',
        message: `resource fields were omitted to fit the Discord ${DISCORD_EMBED_TOTAL_MAX_LENGTH} character embed limit`,
        path: 'palette',
      })
      break
    }
    fields.push(field)
    usedCharacters += fieldCharacters
  }

  return {
    value: {
      title,
      description,
      fields,
      ...(footer ? { footer } : {}),
    },
    warnings,
  }
}

function buildRollButton(
  entry: Extract<ProjectionPaletteEntry, { kind: 'roll' }>,
  channelId: string,
  warnings: ProjectionWarning[]
): DiscordButtonModel | undefined {
  if (!validateIdPart(entry.key, `palette.${entry.key}.key`, warnings)) return undefined
  const customId = createRollPaletteCustomId(channelId, entry.key)
  if (!acceptGeneratedCustomId(customId, `palette.${entry.key}.customId`, warnings)) return undefined
  const rawLabel = labelOrFallback(
    entry.label,
    entry.fieldRef.uid || entry.key,
    `palette.${entry.key}.label`,
    warnings
  )
  const label = truncate(rawLabel, DISCORD_BUTTON_LABEL_MAX_LENGTH)
  warnForTruncation(warnings, rawLabel, label, `palette.${entry.key}.label`)
  return { type: 'button', action: 'roll', label, customId, style: 'primary', paletteKey: entry.key }
}

function buildResourceButtons(
  entry: Extract<ProjectionPaletteEntry, { kind: 'resource' }>,
  channelId: string,
  warnings: ProjectionWarning[]
): DiscordButtonModel[] {
  if (!validateIdPart(entry.key, `palette.${entry.key}.key`, warnings)) return []
  const buttons: DiscordButtonModel[] = []
  for (const delta of entry.deltas) {
    const canonicalDelta = canonicalizeResourceDelta(delta)
    if (!isRenderableResourceDelta(canonicalDelta)) {
      warnings.push({
        code: 'invalid-custom-id-part',
        message: `palette.${entry.key}.deltas contains a value without a canonical decimal customId representation; the action was omitted`,
        path: `palette.${entry.key}.deltas`,
      })
      continue
    }
    const customId = createResourceDeltaCustomId(channelId, entry.key, delta)
    // The canonical delta guard above, validateIdPart, and caller-side validateChannelId make null unreachable; keep fail-closed.
    if (customId === null) continue
    if (!acceptCustomId(customId, `palette.${entry.key}.customId`, warnings)) continue
    const entryLabel = labelOrFallback(
      entry.label,
      entry.fieldRef.uid || entry.key,
      `palette.${entry.key}.label`,
      warnings
    )
    const rawLabel = `${entryLabel} ${delta > 0 ? '+' : ''}${canonicalDelta}`
    const label = truncate(rawLabel, DISCORD_BUTTON_LABEL_MAX_LENGTH)
    warnForTruncation(warnings, rawLabel, label, `palette.${entry.key}.label`)
    buttons.push({
      type: 'button',
      action: 'resource',
      label,
      customId,
      style: delta < 0 ? 'danger' : 'success',
      paletteKey: entry.key,
      delta,
    })
  }
  return buttons
}

function buildPinnedButtonRows(
  palette: readonly ProjectionPaletteEntry[],
  channelId: string,
  pinnedKeys?: readonly string[]
): Result<DiscordButtonRowModel[]> {
  const warnings: ProjectionWarning[] = []
  if (!validateChannelId(channelId, warnings)) return { value: [], warnings }
  const rolls = palette.filter((entry): entry is Extract<ProjectionPaletteEntry, { kind: 'roll' }> => entry.kind === 'roll')
  const requested = pinnedKeys
    ? [...new Set(pinnedKeys)]
        .map((key) => rolls.find((entry) => entry.key === key))
        .filter((entry): entry is Extract<ProjectionPaletteEntry, { kind: 'roll' }> => entry !== undefined)
    : rolls
  if (requested.length > PINNED_BUTTON_LIMIT) {
    warnings.push({
      code: 'pinned-button-limit-exceeded',
      message: `pinned roll buttons were truncated from ${requested.length} to ${PINNED_BUTTON_LIMIT}`,
      path: 'pinnedKeys',
    })
  }
  const buttons = requested
    .slice(0, PINNED_BUTTON_LIMIT)
    .map((entry) => buildRollButton(entry, channelId, warnings))
    .filter((button): button is DiscordButtonModel => button !== undefined)
  return { value: splitRows(buttons), warnings }
}

export function splitPinnedButtonRows(
  palette: readonly ProjectionPaletteEntry[],
  channelId: string,
  pinnedKeys?: readonly string[]
): DiscordButtonRowModel[] {
  return buildPinnedButtonRows(palette, channelId, pinnedKeys).value
}

function buildGroupSelect(
  palette: readonly ProjectionPaletteEntry[],
  channelId: string
): Result<DiscordGroupSelectModel | undefined> {
  const warnings: ProjectionWarning[] = []
  if (!validateChannelId(channelId, warnings)) return { value: undefined, warnings }
  const groups = createGroupReferences(palette, warnings)
  if (groups.length === 0) return { value: undefined, warnings }
  const menuCustomId = createHubGroupSelectCustomId(channelId)
  // validateChannelId above makes null unreachable; keep fail-closed.
  if (menuCustomId === null) return { value: undefined, warnings }
  if (!acceptCustomId(menuCustomId, 'groupSelect.menuCustomId', warnings)) return { value: undefined, warnings }
  const hasMore = groups.length > GROUP_SELECT_VISIBLE_LIMIT
  if (hasMore) {
    warnings.push({
      code: 'group-select-overflow',
      message: `group select shows ${GROUP_SELECT_VISIBLE_LIMIT} of ${groups.length} groups; remaining groups use the browser`,
      path: 'palette.group',
    })
  }
  const options: DiscordSelectOptionModel[] = groups.slice(0, GROUP_SELECT_VISIBLE_LIMIT).map((group) => {
    const label = truncate(group.label, DISCORD_SELECT_LABEL_MAX_LENGTH)
    warnForTruncation(warnings, group.label, label, `group.${group.label}.label`)
    return { label, value: group.id }
  })
  if (hasMore) options.push({ label: 'その他…', value: GROUP_SELECT_MORE_VALUE })
  return {
    value: { type: 'select', menuCustomId, placeholder: 'グループを選択', options, hasMore },
    warnings,
  }
}

export function createGroupSelect(
  palette: readonly ProjectionPaletteEntry[],
  channelId: string
): DiscordGroupSelectModel | undefined {
  return buildGroupSelect(palette, channelId).value
}

function collectProjectionWarnings(input: DiscordProjectionInput): ProjectionWarning[] {
  const warnings: ProjectionWarning[] = []
  if (!validateChannelId(input.channelId, warnings)) return warnings
  for (const entry of input.palette) {
    if (entry.kind === 'roll') buildRollButton(entry, input.channelId, warnings)
    else buildResourceButtons(entry, input.channelId, warnings)
  }
  const groups = createGroupReferences(input.palette, warnings)
  for (const group of groups) {
    const actionCount = countGroupActions(input.palette, group.source)
    const lastPage = Math.max(1, Math.ceil(actionCount / PANEL_ACTIONS_PER_PAGE))
    acceptGeneratedCustomId(
      createHubPanelCustomId(input.channelId, group.id, lastPage),
      `group.${group.label}.panelCustomId`,
      warnings
    )
  }
  const browserLastPage = Math.max(1, Math.ceil(groups.length / GROUP_BROWSER_PAGE_SIZE))
  acceptGeneratedCustomId(
    createHubGroupBrowserCustomId(input.channelId, browserLastPage),
    'groupBrowser.menuCustomId',
    warnings
  )
  return warnings
}

function uniqueWarnings(warnings: readonly ProjectionWarning[]): ProjectionWarning[] {
  const seen = new Set<string>()
  return warnings.filter((warning) => {
    const key = `${warning.code}\u0000${warning.path ?? ''}\u0000${warning.message}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function createDiscordProjectionViewModel(input: DiscordProjectionInput): DiscordProjectionViewModel {
  const embed = buildEmbed(input)
  const pinned = buildPinnedButtonRows(input.palette, input.channelId, input.pinnedKeys)
  const groupSelect = buildGroupSelect(input.palette, input.channelId)
  const warnings: ProjectionWarning[] = uniqueWarnings([
    ...embed.warnings,
    ...pinned.warnings,
    ...groupSelect.warnings,
    ...collectProjectionWarnings(input),
  ])
  if (input.palette.length > PALETTE_SOFT_CAP) {
    warnings.unshift({
      code: 'palette-soft-cap-exceeded',
      message: `palette has ${input.palette.length} entries and exceeds the soft cap of ${PALETTE_SOFT_CAP}`,
      path: 'palette',
    })
  }
  return {
    hub: {
      embed: embed.value,
      pinnedButtonRows: pinned.value,
      groupSelect: groupSelect.value,
    },
    warnings,
  }
}

function clampPage(requestedPage: number | undefined, totalPages: number): number {
  const normalized = Number.isInteger(requestedPage) ? (requestedPage as number) : 1
  return Math.min(Math.max(normalized, 1), totalPages)
}

function pageButton(
  action: 'panel-page' | 'group-browser-page',
  label: string,
  customId: string | null,
  warnings: ProjectionWarning[]
): DiscordButtonModel | undefined {
  if (!acceptGeneratedCustomId(customId, `${action}.${label}`, warnings)) return undefined
  return { type: 'button', action, label, customId, style: 'secondary' }
}

function panelPageNavigation(
  channelId: string,
  groupId: string,
  currentPage: number,
  totalPages: number,
  warnings: ProjectionWarning[]
): PageNavigationModel {
  return {
    currentPage,
    totalPages,
    ...(currentPage > 1
      ? { previous: pageButton('panel-page', '前へ', createHubPanelCustomId(channelId, groupId, currentPage - 1), warnings) }
      : {}),
    ...(currentPage < totalPages
      ? { next: pageButton('panel-page', '次へ', createHubPanelCustomId(channelId, groupId, currentPage + 1), warnings) }
      : {}),
  }
}

export function createEphemeralPanel(input: EphemeralPanelInput): EphemeralPanelViewModel {
  const warnings: ProjectionWarning[] = []
  const group = createGroupReferences(input.palette, warnings).find((candidate) => candidate.id === input.groupId)
  const idsValid =
    validateChannelId(input.channelId, warnings) &&
    validateIdPart(input.groupId, 'groupId', warnings) &&
    group !== undefined
  const entries = group ? input.palette.filter((entry) => entry.group === group.source) : []
  const allActions = idsValid
    ? entries.flatMap((entry) =>
        entry.kind === 'roll'
          ? [buildRollButton(entry, input.channelId, warnings)].filter(
              (button): button is DiscordButtonModel => button !== undefined
            )
          : buildResourceButtons(entry, input.channelId, warnings)
      )
    : []
  const totalPages = Math.max(1, Math.ceil(allActions.length / PANEL_ACTIONS_PER_PAGE))
  const currentPage = clampPage(input.page, totalPages)
  const actions = allActions.slice(
    (currentPage - 1) * PANEL_ACTIONS_PER_PAGE,
    currentPage * PANEL_ACTIONS_PER_PAGE
  )
  return {
    kind: 'group-panel',
    groupId: input.groupId,
    title: group?.label ?? input.groupId,
    actions,
    actionRows: splitRows(actions),
    page: panelPageNavigation(input.channelId, input.groupId, currentPage, totalPages, warnings),
    warnings,
  }
}

function browserPageNavigation(
  channelId: string,
  currentPage: number,
  totalPages: number,
  warnings: ProjectionWarning[]
): PageNavigationModel {
  return {
    currentPage,
    totalPages,
    ...(currentPage > 1
      ? { previous: pageButton('group-browser-page', '前へ', createHubGroupBrowserCustomId(channelId, currentPage - 1), warnings) }
      : {}),
    ...(currentPage < totalPages
      ? { next: pageButton('group-browser-page', '次へ', createHubGroupBrowserCustomId(channelId, currentPage + 1), warnings) }
      : {}),
  }
}

export function createGroupBrowser(input: GroupBrowserInput): GroupBrowserViewModel {
  const warnings: ProjectionWarning[] = []
  const channelValid = validateChannelId(input.channelId, warnings)
  const groups = createGroupReferences(input.palette, warnings)
  const totalPages = Math.max(1, Math.ceil(groups.length / GROUP_BROWSER_PAGE_SIZE))
  const currentPage = clampPage(input.page, totalPages)
  const pageGroups = groups.slice(
    (currentPage - 1) * GROUP_BROWSER_PAGE_SIZE,
    currentPage * GROUP_BROWSER_PAGE_SIZE
  )
  const menuCustomId = createHubGroupBrowserCustomId(input.channelId, currentPage)
  // Invalid channels make the factory return null; channelValid && short-circuits before this null check.
  // With a valid channel, clampPage returns 1..totalPages, so the factory's page pattern cannot return null.
  // Keep both null checks: they narrow menuCustomId for acceptCustomId and the returned view model.
  const menuAccepted =
    channelValid && menuCustomId !== null && acceptCustomId(menuCustomId, 'groupBrowser.menuCustomId', warnings)
  const options = menuAccepted
    ? pageGroups.map((group) => {
        const label = truncate(group.label, DISCORD_SELECT_LABEL_MAX_LENGTH)
        warnForTruncation(warnings, group.label, label, `group.${group.label}.label`)
        return { label, value: group.id }
      })
    : []
  return {
    kind: 'group-browser',
    title: 'その他のグループ',
    menuCustomId: menuAccepted && menuCustomId !== null ? menuCustomId : '',
    options,
    page: browserPageNavigation(input.channelId, currentPage, totalPages, warnings),
    warnings,
  }
}
