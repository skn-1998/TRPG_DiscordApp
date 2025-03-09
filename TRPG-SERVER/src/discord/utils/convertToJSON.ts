import { sortBy } from "lodash"
import { Character, UpdatePrimary } from "src/DB/character/models/character.model"

type characterInfo = {
  name: string
  value: number
  index: number
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

export function convertCharacterInfoToJson(
  data: string
): GeneralAttributeUpdate {
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
        value: value,
        index: index
      }
      index++
    }
  }

  return result
}

export function convertCharacterJsonToString(data:Character,updatePrimary:UpdatePrimary):string{
  const sortedArray = sortBy(data[updatePrimary],[(status)=>{return status.index}])
  return sortedArray.map(status=>`${status.name}:${status.value}`).join('\n')
}
