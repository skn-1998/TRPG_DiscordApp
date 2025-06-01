import { Button, ComboboxItem, OptionsFilter } from '@mantine/core'
import { useOutletContext } from '@remix-run/react'
import axios from 'axios'
import { CustomError } from '~/utils/customError'
import { Select } from '@mantine/core'
import gameSystemList from '~/static/gameSystemList.json'
import { useState } from 'react'
import _ from 'lodash'
import Fuse from 'fuse.js'
import moji from 'moji'
import convertRomanToKana from '~/utils/convertRomanToKana'

export type GameSystemJSON = {
  ID: string
  NAME: string
  SORT_KEY: string
  HELP_MESSAGE: string
  PRIORITY?: number
}

const fuseOptions = {
  threshold: 0.4,
  keys: ['NAME']
}

const _gameSystemList = _.sortBy(gameSystemList, ['PRIORITY', 'SORT_KEY'])

const fuse = new Fuse<GameSystemJSON>(_gameSystemList, fuseOptions)

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

export function CharacterCreate() {
  async function clickHandler() {
    console.log('clicked!')
    if (!TRPGSystemValue) {
      console.log('no select TRPG System')
      return
    }
  }

  const [TRPGSystemValue, setTRPGSystemValue] = useState<ComboboxItem | null>(null)

  return (
    <>
      <div>Character create page</div>
      <Button onClick={clickHandler}>create character</Button>
      <Select
        label="TRPG System"
        placeholder="Pick TRPG System"
        data={gameSystemListID}
        searchable
        nothingFoundMessage="Nothing found..."
        value={TRPGSystemValue ? TRPGSystemValue.value : null}
        onChange={(_value, option) => setTRPGSystemValue(option)}
        // maxDropdownHeight={500}
        withScrollArea={false}
        styles={{ dropdown: { maxHeight: 500, overflowY: 'auto' } }}
        mt="md"
        filter={optionsFilter}
      />
    </>
  )
}
