import useBoundStore from '~/store'
import { Button } from '@mantine/core'

export default function ZustandTest() {
  const incrementCount = useBoundStore((state) => state.incrementCount)
  const count = useBoundStore((state) => state.count)

  return (
    <>
      <p>{count}</p>
      <Button onClick={() => incrementCount()}>increment</Button>
    </>
  )
}
