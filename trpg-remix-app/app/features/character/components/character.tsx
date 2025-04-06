import { Button } from '@mantine/core'
import { json, LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData, useOutletContext } from '@remix-run/react'
import axios from 'axios'
import { validateJWT } from '~/utils/axiosClient'
import { CustomError } from '~/utils/customError'
// import 'dotenv/config'
import type { loader as parentLoader } from '~/routes/_user.user'

export function Character() {
  const data = useOutletContext<ReturnType<typeof parentLoader>>()

  async function clickHandler(){
    console.log('clicked!')
    const corsServerDomain = 'http://localhost:3000'
    // console.log(corsServerDomain)
    try
    {
      // const res = await axios.get(`${corsServerDomain}/characters`,{headers: {'Content-Type': 'application/json'}, withCredentials: true })
      const res = await axios.post(`${corsServerDomain}/characters/create`, { TRPGName: 'Cthulhu', DiscordChannelId: '584423849811247105' }, { headers: {'Content-Type': 'application/json'}, withCredentials: true })
      console.log('res res:' + res)
    }catch(Error)
    {
      CustomError(Error)
    }
    // const res = await axios.get('/trpg-user')
    // const res = 'axios post の予定'
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
