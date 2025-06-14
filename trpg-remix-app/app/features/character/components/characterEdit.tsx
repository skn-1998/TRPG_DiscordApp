import { Button, ComboboxItem, NumberInput } from '@mantine/core'
import { useOutletContext } from '@remix-run/react'
import axios from 'axios'
import { CustomError } from '~/utils/customError'
import { Select } from '@mantine/core'
import gameSystemList from '~/static/gameSystemList.json'
import { useState } from 'react'

export function CharacterEditMock() {
  return (
    <>
      character edit
      <NumberInput />
    </>
  )
}
