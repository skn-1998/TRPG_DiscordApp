/* eslint-disable @typescript-eslint/no-unused-vars */
import { Button, ComboboxItem } from '@mantine/core'
import { useOutletContext } from '@remix-run/react'
import axios from 'axios'
import { CustomError } from '~/utils/customError'
import { Select } from '@mantine/core'
import { gameSystemOptions, createGameSystemOptionsFilter, getGameSystemNameById } from '~/lib/gameSystem'
import { useState } from 'react'
