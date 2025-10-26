import { Outlet } from '@remix-run/react'
import { CharacterCreate } from '~/features/character'

export default function CharacterEdit() {
  return (
    <div>
      character edit
      <Outlet />
    </div>
  )
}
