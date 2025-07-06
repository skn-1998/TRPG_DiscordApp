import styles from './flexTable.module.css'

function BunchHeader() {
  return (
    <>
      <div className={styles.bunch}>
        <div className={styles.sideHeaderCell}></div>
        <div className={styles.headerCell}>aaa</div>
        <div className={styles.headerCell}>bbb</div>
        <div className={styles.headerCell}>ccc</div>
        <div className={styles.headerCell}>ddd</div>
        <div className={styles.headerCell}>eee</div>
        <div className={styles.headerCell}>fff</div>
      </div>
    </>
  )
}

function Cell() {
  return (
    <>
      <div className={styles.cell}>
        <div className={styles.cellWrap}>
          <div className={styles.cellWrapWrap}>
            <input type="number" className={styles.cellInputNumber}></input>
          </div>
        </div>
      </div>
    </>
  )
}

function Bunch() {
  return (
    <>
      <div className={styles.bunch}>
        <div className={styles.sideHeaderCell}>zzz</div>
        <Cell />
        <Cell />
        <Cell />
        <Cell />
        <Cell />
        <Cell />
      </div>
    </>
  )
}

export function FlexTable() {
  return (
    <>
      <div className={styles.mainContainer}>
        <div className={styles.tableContainer}>
          <BunchHeader />
          <Bunch />
          <Bunch />
          <Bunch />
          <Bunch />
          <Bunch />
          <Bunch />
        </div>
      </div>
    </>
  )
}
