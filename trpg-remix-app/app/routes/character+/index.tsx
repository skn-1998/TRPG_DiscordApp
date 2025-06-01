import { Outlet } from '@remix-run/react'
import { CharacterCreate } from '~/features/character'

export default function Character() {
  return (
    <div>
      character
      <CharacterCreate />
      <Outlet />
    </div>
  )
}
