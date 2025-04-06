import { Button } from '@mantine/core'
import { useOutletContext } from '@remix-run/react'
import axios from 'axios'
import { CustomError } from '~/utils/customError'

export function Character() {
  const outletContextData = useOutletContext<{ data: any, cookie: string }>()

  const jwtCookie = outletContextData.cookie.split(';').find(cookie => cookie.trim().startsWith('jwt='))
    if (!jwtCookie) {
      throw new Error('no jwtCookie')
    }
  const jwt = jwtCookie.split('=')[1]

  async function clickHandler(){
    console.log('clicked!')
    const corsServerDomain = 'http://localhost:3000'
    try
    {
      const res = await axios.post(`${corsServerDomain}/characters/create`, { TRPGName: 'Cthulhu' }, { headers: {'Content-Type': 'application/json', Authorization: `Bearer ${jwt}`}, withCredentials: true })
      console.log('--- res ---')
      console.log(res)
    }catch(Error)
    {
      CustomError(Error)
    }
  }

  return (
    <>
      <div>
        Character create page
      </div>
      <Button onClick={clickHandler}>create character</Button>
    </>
  )
}
