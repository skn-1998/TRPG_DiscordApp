import { Outlet } from '@remix-run/react'
import { CharacterCreate } from '~/features/character'
import { action as _action } from '~/features/character'

export const action = _action

export default function Character() {
  return (
    <div>
      character
      <CharacterCreate />
      <Outlet />
    </div>
  )
}
