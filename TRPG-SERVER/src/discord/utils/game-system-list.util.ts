export type GameSystemJSON = { ID: string; NAME: string; SORT_KEY: string; HELP_MESSAGE: string }

export function parseGameSystemList(data: unknown): GameSystemJSON[] {
  if (!Array.isArray(data)) {
    throw new Error('gameSystemList の構造が不正です: 配列ではありません')
  }
  if (data.length === 0) {
    throw new Error('gameSystemList の構造が不正です: 配列が空です')
  }

  for (const [index, item] of data.entries()) {
    const candidate = item as Partial<GameSystemJSON> | null | undefined
    if (typeof candidate?.ID !== 'string') {
      throw new Error(`gameSystemList の構造が不正です: index ${index} の ID が文字列ではありません`)
    }
    if (typeof candidate.NAME !== 'string') {
      throw new Error(`gameSystemList の構造が不正です: index ${index} の NAME が文字列ではありません`)
    }
    if (typeof candidate.SORT_KEY !== 'string') {
      throw new Error(`gameSystemList の構造が不正です: index ${index} の SORT_KEY が文字列ではありません`)
    }
    if (typeof candidate.HELP_MESSAGE !== 'string') {
      throw new Error(`gameSystemList の構造が不正です: index ${index} の HELP_MESSAGE が文字列ではありません`)
    }
  }

  return data as GameSystemJSON[]
}
