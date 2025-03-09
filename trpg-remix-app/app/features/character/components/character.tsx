import { Button } from '@mantine/core'
import axios from 'axios'
import { CustomError } from '~/utils/customError'
// import 'dotenv/config'

export function Character() {
  async function clickHandler(){
    console.log('clicked!')
    const corsServerDomain = 'http://localhost:3000'
    console.log(corsServerDomain)
    try
    {
      const res = await axios.get(`${corsServerDomain}/characters`,{headers: {'Content-Type': 'application/json'}, withCredentials: true })
      console.log(res)
    }catch(Error)
    {
      CustomError(Error)
    }
    // const res = await axios.post('/characters/create', { TRPGName: 'Cthulhu', DiscordUserId: '584423849811247105' })
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
