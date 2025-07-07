import styles from './flexTable2.module.css'

function TextBunch() {
  return (
    <>
      <div className={styles.textBunch}>
        <div className={`${styles.textHeaderCell} ${styles.inputCellCommon}`}>
          <b>技能名</b>
        </div>
        <TextCell text="aaa" />
        <TextCell text="bbb" />
        <TextCell text="ccc" />
      </div>
    </>
  )
}

type Props = {
  text: string
}

function TextCell(props: Props) {
  return (
    <>
      <div className={`${styles.textCell} ${styles.textCellCommon}`}>
        <div className={styles.textCellInner}>
          <div className={styles.textCellInnerInner}>
            <div>{props.text}</div>
          </div>
        </div>
      </div>
    </>
  )
}

function InputBunch(props: Props) {
  return (
    <>
      <div className={styles.inputBunch}>
        <div className={`${styles.inputHeaderCell} ${styles.inputCellCommon}`}>
          <b>{props.text}</b>
        </div>
        <InputCell />
        <InputCell />
        <InputCell />
      </div>
    </>
  )
}

function InputCell() {
  return (
    <>
      <div className={`${styles.inputCell} ${styles.inputCellCommon}`}>
        <div className={styles.inputCellInner}>
          <div className={styles.inputCellInnerInner}>
            <input type="number" className={styles.inputNumber} />
          </div>
        </div>
      </div>
    </>
  )
}

export function FlexTable2() {
  return (
    <>
      <div className={styles.widthWrap}>
        <div className={styles.tableWrap}>
          <TextBunch />
          <InputBunch text="111" />
          <InputBunch text="222" />
          <InputBunch text="333" />
          <InputBunch text="444" />
          <InputBunch text="555" />
        </div>
      </div>
    </>
  )
}
