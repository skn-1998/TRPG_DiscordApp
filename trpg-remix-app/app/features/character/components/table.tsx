import { ChangeEventHandler } from 'react'
import styles from './flexTable2.module.css'

type TextCellProps = {
  text: string
}

function TextCell({ text }: TextCellProps) {
  return (
    <>
      <div className={`${styles.textCell} ${styles.textCellCommon}`}>
        <div className={styles.textCellInner}>
          <div className={styles.textCellInnerInner}>
            <div>{text}</div>
          </div>
        </div>
      </div>
    </>
  )
}

type InputCellProps = {
  value: string
  changeHandler: ChangeEventHandler<HTMLInputElement>
}

function InputCell({ value, changeHandler }: InputCellProps) {
  return (
    <>
      <div className={`${styles.inputCell} ${styles.inputCellCommon}`}>
        <div className={styles.inputCellInner}>
          <div className={styles.inputCellInnerInner}>
            <input type="number" className={styles.inputNumber} onChange={changeHandler} value={value} />
          </div>
        </div>
      </div>
    </>
  )
}

type SideGroupProps = {
  sideHeaderText: string
}

function SideGroup({ sideHeaderText }: SideGroupProps) {
  return (
    <>
      <div className={styles.textGroup}>
        <div className={`${styles.textHeaderCell} ${styles.inputCellCommon}`}>
          <b>{sideHeaderText}</b>
        </div>
      </div>
    </>
  )
}
