import { NumberInput } from '@mantine/core'
import styles from './gridTest.module.css'

export function GridTest() {
  return (
    <>
      <div className={styles.container}>
        <div className={styles.item}></div>
        <div className={styles.item2}></div>
      </div>
      <div className={styles.container2}>
        <div className={styles.test2}>
          <NumberInput className={styles.test} />
          <NumberInput className={styles.test} />
        </div>
        <div className={styles.test2}>
          <NumberInput className={styles.test} />
          <NumberInput className={styles.test} />
        </div>
      </div>
    </>
  )
}
