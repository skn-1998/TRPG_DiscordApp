'use client'

import { FlexTable } from '~/features/character/components/flexTable'
import { FlexTable2 } from '~/features/character/components/flexTable2'
import { StatusTable } from '~/features/character/components/statusTable'
import { TestTable } from '~/features/character/components/table'

export default function GridStudyPage() {
  return (
    <>
      <FlexTable />
      <FlexTable2 />
      <StatusTable />
      <TestTable />
    </>
  )
}
