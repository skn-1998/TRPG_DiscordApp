import useStore from '~/store'
import { InputCell } from './table'
import { useEffect } from 'react'

export function CharacterTable() {
  const character = useStore((state) => state.character)
  const updateCharacterAttributeValue = useStore((state) => state.updateCharacterAttributeValue)

  const skillKeys = Object.keys(character.skill)

  const skillInputCells = skillKeys.map((key) => {
    const values = character.skill[key].values
    const hoge = Object.keys(values).map((k) => {
      const dispatch = (value: string) => {
        const numericValue = isNaN(Number(value)) ? 0 : Number(value)
        updateCharacterAttributeValue('skill', key, k, numericValue)
      }

      const defaultValue = values[k] === 0 ? '' : `${values[k]}`
      return <InputCell key={`${key}-${k}`} defaultValue={defaultValue} dispatch={dispatch} />
    })
    return hoge
  })

  return (
    <>
      {skillInputCells}
      <button
        onClick={() => {
          updateCharacterAttributeValue('skill', 'sample', 'initial', 1024)
        }}
      >
        push
      </button>
    </>
  )
}
