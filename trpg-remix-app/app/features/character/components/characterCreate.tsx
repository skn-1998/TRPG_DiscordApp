import { Button, ComboboxItem, OptionsFilter } from '@mantine/core'
import { Select } from '@mantine/core'
import gameSystemList from '~/static/gameSystemList.json'
import { useState } from 'react'
import _ from 'lodash'
import Fuse from 'fuse.js'
import moji from 'moji'
import convertRomanToKana from '~/utils/convertRomanToKana'
import { createCharacter } from '../api/character.service'
import { GameSystemJSON } from '~/lib/types'
import { ActionFunctionArgs, json } from '@remix-run/node'
import { CustomError } from '~/utils/customError'
import axios from 'axios'
import { getJwtFromRequest } from '~/features/auth'

const fuseOptions = {
  threshold: 0.4,
  keys: ['SEARCH_KEY_KANJI', 'SEARCH_KEY_HIRAGANA']
}

const _gameSystemList = _.sortBy(gameSystemList, ['PRIORITY', 'SORT_KEY'])

const fuse = new Fuse<GameSystemJSON>(_gameSystemList, fuseOptions)

const gameSystemListID = _gameSystemList.map((e) => ({ value: e.ID, label: e.NAME }))

export function convertSearchText(str: string) {
  const _str = str.trim()
  // 全角英数・全角スペースを半角に
  const HE = moji(_str).convert('ZS', 'HS').convert('ZE', 'HE').toString()
  // ローマ字をカタカナに
  const KKfromRoman = convertRomanToKana(HE)
  // カタカナをひらがなに統一 ローマ字(英字)はそのまま
  const convertedWithRoman = moji(HE).convert('KK', 'HG').toString()
  // ローマ字をカタカナにしてからひらがなに統一
  const convertedAllHG = moji(KKfromRoman).convert('KK', 'HG').toString()
  return [convertedWithRoman, convertedAllHG]
}

const optionsFilter: OptionsFilter = ({ options, search }) => {
  const _search = search.trim()
  if (_search === '') return gameSystemListID
  const gameSystemSearchText = convertSearchText(_search.slice(0, 200))
  const gameSystemSearchArr_KANJI = gameSystemSearchText.map((e) => ({ SEARCH_KEY_KANJI: e }))
  const gameSystemSearchArr_HIRAGANA = gameSystemSearchText.map((e) => ({ SEARCH_KEY_HIRAGANA: e }))
  const gameSystemSearchArr = [...gameSystemSearchArr_KANJI, ...gameSystemSearchArr_HIRAGANA]
  const _gameSystemSearchResults = fuse.search({ $or: gameSystemSearchArr }).map((e) => e.item)
  // const gameSystemSearchResults = _.sortBy(_gameSystemSearchResults, ['PRIORITY'])
  const gameSystemSearchResults = _gameSystemSearchResults
  const formattedResult = gameSystemSearchResults.map((e) => ({ value: e.ID, label: e.NAME }))
  return formattedResult
}

interface CharacterCreateProps {
  jwt?: string
  userId?: string
}

export async function action(args: ActionFunctionArgs) {
  console.log('action')
  const { request, context, params } = args

  try {
    const body = await request.formData()
    console.log(...body.entries())
  } catch (error) {
    console.log(CustomError(error))
  }

  const data = await createCharacter(
    { name: 'characterName', gameSystemId: 'Pathfinder', userId: 'sample' },
    'sample_jwt'
  )
  console.log(data)

  return data
}

export function CharacterCreate() {
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

    setIsLoading(true)

    try {
      const formData = new FormData()
      const characterData = {
        name: characterName,
        gameSystemId: TRPGSystemValue.value,
        userId: ''
      }
      formData.append('characterData', JSON.stringify(characterData))

      // const newCharacter = await createCharacter(characterData, jwt)
      const res = await axios.post('/character', formData)
      console.log('Character created:', res)

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
