import { Outlet } from '@remix-run/react'
import { CharacterCreate } from '~/features/character'
import { CharacterEditMock } from '~/features/character/components/characterEdit'

export default function CharacterEdit() {
  return (
    <div>
      character edit
      <CharacterEditMock />
      <Outlet />
    </div>
  )
}
