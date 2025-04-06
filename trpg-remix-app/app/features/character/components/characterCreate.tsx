import { Button, ComboboxItem } from '@mantine/core'
import { useOutletContext } from '@remix-run/react'
import axios from 'axios'
import { CustomError } from '~/utils/customError'
import { Select } from '@mantine/core'
import gameSystemList from '~/static/gameSystemList.json'
import { useState } from 'react'
import _ from 'lodash'

const _gameSystemList = _.sortBy(gameSystemList, ['SORT_KEY'])
const gameSystemListID = _gameSystemList.map(e => ({ value: e.ID, label: e.NAME }))

export function CharacterCreate() {
  const outletContextData = useOutletContext<{ data: any, cookie: string }>()

  const jwtCookie = outletContextData.cookie.split(';').find(cookie => cookie.trim().startsWith('jwt='))
    if (!jwtCookie) {
      throw new Error('no jwtCookie')
    }
  const jwt = jwtCookie.split('=')[1]

  const headers = {'Content-Type': 'application/json', Authorization: `Bearer ${jwt}`}

  async function clickHandler(){
    console.log('clicked!')
    const corsServerDomain = 'http://localhost:3000'

    if (!TRPGSystemValue) {
      console.log('no select TRPG System')
      return
    }

    try
    {
      const res = await axios.post(`${corsServerDomain}/characters/create`,
        { TRPGName: TRPGSystemValue.value },
        { headers , withCredentials: true })
      console.log('--- res ---')
      console.log(res)
    }catch(Error)
    {
      CustomError(Error)
    }
  }

  const [TRPGSystemValue, setTRPGSystemValue] = useState<ComboboxItem | null>(null)

  return (
    <>
      <div>
        Character create page
      </div>
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
      />
    </>
  )
}
