import { ChangeEvent, ChangeEventHandler, ReactNode, useState } from 'react'
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

function SideInputCell({ value, changeHandler }: InputCellProps) {
  return (
    <>
      <div className={`${styles.textCell} ${styles.textCellCommon}`}>
        <div className={styles.textCellInner}>
          <div className={styles.sideInputWrap}>
            <input type="text" className={styles.inputText} value={value} onChange={changeHandler} />
          </div>
        </div>
      </div>
    </>
  )
}

type SideGroupProps = {
  sideHeaderText: string
  sideCellGroup: ReactNode
}

function SideGroup({ sideHeaderText, sideCellGroup }: SideGroupProps) {
  return (
    <>
      <div className={styles.textGroup}>
        <div className={`${styles.textHeaderCell} ${styles.inputCellCommon}`}>
          <b>{sideHeaderText}</b>
        </div>
        {sideCellGroup}
      </div>
    </>
  )
}

function SideCellGroup() {
  const [value, setValue] = useState('運転()')

  const changeHandler = (e: ChangeEvent<HTMLInputElement>) => setValue(e.target.value)

  return (
    <>
      <SideInputCell value={value} changeHandler={changeHandler} />
    </>
  )
}

export function TestSideGroup() {
  return (
    <>
      <SideGroup sideHeaderText="hello" sideCellGroup={<SideCellGroup />}></SideGroup>
    </>
  )
}
