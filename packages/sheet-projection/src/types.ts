export interface ProjectionPaletteEntryBase {
  key: string
  fieldRef: { uid: string; rowId?: string }
  label: string
  group: string
}

export type ProjectionPaletteEntry =
  | (ProjectionPaletteEntryBase & {
      kind: 'roll'
      notation: string
      deltas?: never
    })
  | (ProjectionPaletteEntryBase & {
      kind: 'resource'
      notation?: never
      deltas: number[]
    })

export interface DiscordProjectionInput {
  characterName: string
  templateName?: string
  templateVersion: string
  channelId: string
  palette: readonly ProjectionPaletteEntry[]
  /** resource roleにshowInEmbedが無いPhase 2では、全resourceをpalette順に投影する。 */
  resourceValues?: Readonly<Record<string, unknown>>
  /** 未指定時はroll paletteの先頭20件を決定的fallbackとして使う。 */
  pinnedKeys?: readonly string[]
  opId?: string
}

export type ProjectionWarningCode =
  | 'palette-soft-cap-exceeded'
  | 'pinned-button-limit-exceeded'
  | 'group-select-overflow'
  | 'group-id-normalized'
  | 'empty-group-omitted'
  | 'invalid-custom-id-part'
  | 'custom-id-budget-exceeded'
  | 'empty-label-fallback'
  | 'label-truncated'
  | 'embed-truncated'

export interface ProjectionWarning {
  code: ProjectionWarningCode
  message: string
  path?: string
}

export interface DiscordEmbedFieldModel {
  name: string
  value: string
  inline: boolean
}

export interface DiscordEmbedModel {
  title: string
  description?: string
  fields: DiscordEmbedFieldModel[]
  footer?: { text: string }
}

export interface DiscordButtonModel {
  type: 'button'
  action: 'roll' | 'resource' | 'panel-page' | 'group-browser-page'
  label: string
  customId: string
  style: 'primary' | 'secondary' | 'success' | 'danger'
  paletteKey?: string
  delta?: number
}

export type DiscordButtonRowModel = DiscordButtonModel[]

export interface DiscordSelectOptionModel {
  label: string
  value: string
}

export interface DiscordGroupSelectModel {
  type: 'select'
  menuCustomId: string
  placeholder: string
  options: DiscordSelectOptionModel[]
  hasMore: boolean
}

export interface HubViewModel {
  embed: DiscordEmbedModel
  pinnedButtonRows: DiscordButtonRowModel[]
  groupSelect?: DiscordGroupSelectModel
}

export interface DiscordProjectionViewModel {
  hub: HubViewModel
  warnings: ProjectionWarning[]
}

export interface EphemeralPanelInput {
  channelId: string
  palette: readonly ProjectionPaletteEntry[]
  groupId: string
  canMutate: boolean
  page?: number
}

export interface PageNavigationModel {
  currentPage: number
  totalPages: number
  previous?: DiscordButtonModel
  next?: DiscordButtonModel
}

export interface EphemeralPanelViewModel {
  kind: 'group-panel'
  status: 'actions' | 'no-authorized-actions'
  groupId: string
  title: string
  actions: DiscordButtonModel[]
  actionRows: DiscordButtonRowModel[]
  page: PageNavigationModel
  warnings: ProjectionWarning[]
}

export interface GroupBrowserInput {
  channelId: string
  palette: readonly ProjectionPaletteEntry[]
  page?: number
}

export interface GroupBrowserViewModel {
  kind: 'group-browser'
  title: string
  menuCustomId: string
  options: DiscordSelectOptionModel[]
  page: PageNavigationModel
  warnings: ProjectionWarning[]
}
