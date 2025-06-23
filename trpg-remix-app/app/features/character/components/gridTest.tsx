import { NumberInput } from '@mantine/core'
import styles from './gridTest.module.css'

export function GridTest() {
  return (
    <>
      <div className={styles.table}>
        <div className={styles.row}>
          <div className={styles.cell}>技能名</div>
          <div className={styles.cell}>初期値</div>
          <div className={styles.cell}>職業</div>
          <div className={styles.cell}>興味</div>
          <div className={styles.cell}>その他</div>
          <div className={styles.cell}>合計</div>
        </div>
        <div className={styles.row}>
          <div className={styles.cell}>こぶし</div>
          <NumberInput className={styles.cell} />
          <NumberInput className={styles.cell} />
          <NumberInput className={styles.cell} />
          <NumberInput className={styles.cell} />
          <NumberInput className={styles.cell} />
        </div>
        <div className={styles.row}>
          <div className={styles.cell}>頭突き</div>
          <NumberInput className={styles.cell} />
          <NumberInput className={styles.cell} />
          <NumberInput className={styles.cell} />
          <NumberInput className={styles.cell} />
          <NumberInput className={styles.cell} />
        </div>
      </div>
    </>
  )
}
