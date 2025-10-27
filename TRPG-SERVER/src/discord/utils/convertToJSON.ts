import { isNil, sortBy, update } from 'lodash'
import { Character, UpdatePrimary } from 'src/domains/character/models/character.model'

type characterInfo = {
  name: string
  index: number

  other: number
  [key: string]: string | number
}

type GeneralAttributeUpdate = {
  [attributeName: string]: characterInfo
}

//
//送られてきた値に対して"string:int"という形式のもののみを抜き出す
//
export function filterAndFormatInput(input: string): string {
  const regex = /(.{1,15}):(\d{1,10})/g
  let result: string = ''
  let match

  while ((match = regex.exec(input)) !== null) {
    result += match[0] + '\n'
  }

  return result.trim()
}

export function convertCharacterInfoToJson(data: string): GeneralAttributeUpdate {
  const result: GeneralAttributeUpdate = {}

  const characterInfoRegex = /(.{1,15}):(\d{1,10})/g
  let match
  let index = 0
  while ((match = characterInfoRegex.exec(data)) !== null) {
    const name = match[1].trim()
    const value = parseInt(match[2], 10)
    if (!isNaN(value)) {
      result[name] = {
        name: name,
        other: value,
        index: index
      }
      index++
    }
  }

  return result
}

export function convertCharacterJsonToString(data: Character, updatePrimary: UpdatePrimary): string {
  // Record<string, unknown>型から配列に変換して型安全に処理

  const recordData = data?.[updatePrimary] as Record<string, unknown>
  if (isNil(recordData)) return ''

  console.log(JSON.stringify(recordData))
  if (!recordData || typeof recordData !== 'object') {
    return ''
  }

  // オブジェクトを配列に変換
  const dataArray = Object.entries(recordData).map(([key, value]) => {
    // 型安全に処理
    const item = value as {
      name?: string
      other?: number
      index?: number
      [key: string]: string | number | undefined
    }

    // indexとname以外のnumberプロパティを合計
    let totalOtherValues = 0
    for (const [propKey, propValue] of Object.entries(item)) {
      if (propKey !== 'name' && propKey !== 'index' && typeof propValue === 'number') {
        totalOtherValues += propValue
      }
    }

    return {
      name: item.name || key,
      totalValue: totalOtherValues,
      index: item.index || 0
    }
  })

  // ソート処理
  const sortedArray = sortBy(dataArray, [(status) => status.index])
  // 文字列に変換
  return sortedArray.map((status) => `${status.name}:${status.totalValue}`).join('\n')
}
