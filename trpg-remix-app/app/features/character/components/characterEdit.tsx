'use client'

/* eslint-disable @typescript-eslint/no-unused-vars */
import { Button, ComboboxItem, NumberInput } from '@mantine/core'
import axios from 'axios'
import { CustomError } from '~/utils/customError'
import { Select } from '@mantine/core'
import { gameSystemOptions, createGameSystemOptionsFilter, getGameSystemNameById } from '~/lib/gameSystem'
import { useState } from 'react'
import './characterEdit.modules.css'

function Row() {
  return (
    <>
      <div className="row">
        <NumberInput className="temp" hideControls />
        <NumberInput className="temp" hideControls />
        <NumberInput className="temp" hideControls />
      </div>
    </>
  )
}

export function CharacterEditMock() {
  return (
    <>
      character edit
      <NumberInput />
      <Row />
      <Row />
      <Row />
    </>
  )
}
