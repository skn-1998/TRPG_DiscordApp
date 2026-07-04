'use client'

import { Button } from '@mantine/core'
import useStore from '~/store'

export default function ZustandTestPage() {
  const increment = useStore((state) => state.increment)
  const decrement = useStore((state) => state.decrement)
  const count = useStore((state) => state.count)
  const setA = useStore((state) => state.setA)
  const setB = useStore((state) => state.setB)
  const abc = useStore((state) => state.abc)

  return (
    <>
      <p>{count}</p>
      <Button onClick={increment}>increment</Button>
      <Button onClick={decrement}>decrement</Button>
      <p>{abc}</p>
      <Button onClick={setA}>setA</Button>
      <Button onClick={setB}>setB</Button>
    </>
  )
}
