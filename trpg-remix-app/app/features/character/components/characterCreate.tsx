import { Button, ComboboxItem, OptionsFilter } from '@mantine/core'
import { Select } from '@mantine/core'
import gameSystemList from '~/static/gameSystemList.json'
import { useState } from 'react'
import _ from 'lodash'
import moji from 'moji'
import convertRomanToKana from '~/utils/convertRomanToKana'
import { createCharacter } from '../api/character.service'
import { GameSystemJSON } from '~/lib/types'

const _gameSystemList = _.sortBy(gameSystemList, ['PRIORITY', 'SORT_KEY'])

const gameSystemListID = _gameSystemList.map((e) => ({ value: e.ID, label: e.NAME }))

export function convertSearchText(str: string) {
  const hiragana = moji(str).convert('KK', 'HG').toString()
  const katakana = moji(str).convert('HG', 'KK').toString()
  const katakanaFromRoman = convertRomanToKana(str)
  return [str, hiragana, katakana, katakanaFromRoman]
}

const optionsFilter: OptionsFilter = ({ options, search }) => {
  const splittedSearch = search.toLowerCase().trim().split(' ')
  return (options as ComboboxItem[]).filter((option) => {
    const words = option.label.toLowerCase().trim().split(' ')
    return splittedSearch.every((searchWord) => words.some((word) => word.includes(searchWord)))
  })
}

interface CharacterCreateProps {
  jwt?: string
  userId?: string
}

export function CharacterCreate({ jwt, userId }: CharacterCreateProps) {
  const [TRPGSystemValue, setTRPGSystemValue] = useState<ComboboxItem | null>(null)
  const [characterName, setCharacterName] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)

  async function handleCreateCharacter() {
    console.log('clicked!')

    if (!TRPGSystemValue) {
      console.log('no select TRPG System')
      return
    }

    if (!characterName.trim()) {
      console.log('no character name')
      return
    }

    if (!jwt || !userId) {
      console.log('no jwt or userId')
      return
    }

    setIsLoading(true)

    try {
      const characterData = {
        name: characterName,
        gameSystemId: TRPGSystemValue.value,
        userId: userId
      }

      const newCharacter = await createCharacter(characterData, jwt)
      console.log('Character created:', newCharacter)

      // キャラクター作成成功後の処理（リダイレクトなど）
      // TODO: 成功時の処理を実装
    } catch (error) {
      console.error('Character creation failed:', error)
      // TODO: エラーハンドリングを実装
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <div>Character create page</div>

      <input
        type="text"
        placeholder="Character Name"
        value={characterName}
        onChange={(e) => setCharacterName(e.target.value)}
        style={{ marginBottom: '1rem', padding: '0.5rem' }}
      />

      <Button
        onClick={handleCreateCharacter}
        disabled={isLoading || !TRPGSystemValue || !characterName.trim()}
        loading={isLoading}
      >
        {isLoading ? 'Creating...' : 'Create Character'}
      </Button>

      <Select
        label="TRPG System"
        placeholder="Pick TRPG System"
        data={gameSystemListID}
        searchable
        nothingFoundMessage="Nothing found..."
        value={TRPGSystemValue ? TRPGSystemValue.value : null}
        onChange={(_value, option) => setTRPGSystemValue(option)}
        withScrollArea={false}
        styles={{ dropdown: { maxHeight: 500, overflowY: 'auto' } }}
        mt="md"
        filter={optionsFilter}
      />
    </>
  )
}
