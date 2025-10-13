import { ChangeEvent, ChangeEventHandler, ReactNode, useState } from 'react'
import styles from './flexTable.module.css'
import { CloseButton } from '@mantine/core'

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
  changeHandler?: ChangeEventHandler<HTMLInputElement>
  disabled?: boolean
}

function InputCell({ value, changeHandler, disabled = false }: InputCellProps) {
  return (
    <>
      <div className={`${styles.inputCell} ${styles.inputCellCommon}`}>
        <div className={styles.inputCellInner}>
          <div className={styles.inputCellInnerInner}>
            <input
              type="number"
              className={styles.inputNumber}
              onChange={changeHandler}
              value={value}
              disabled={disabled}
            />
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
  headerText: string
  children: ReactNode
}

function SideGroup({ headerText, children }: SideGroupProps) {
  return (
    <>
      <div className={styles.textGroup}>
        <div className={`${styles.textHeaderCell} ${styles.inputCellCommon}`}>
          <b>{headerText}</b>
        </div>
        {children}
      </div>
    </>
  )
}

//
function SideCellGroup() {
  const [value, setValue] = useState('運転（）')

  const changeHandler = (e: ChangeEvent<HTMLInputElement>) => setValue(e.target.value)

  return (
    <>
      <SideInputCell value={value} changeHandler={changeHandler} />
    </>
  )
}

function SideCellGroup2() {
  return (
    <>
      <TextCell text="qqq" />
      <TextCell text="www" />
      <TextCell text="eee" />
      <TextCell text="rrr" />
    </>
  )
}

export function TestSideGroup() {
  return (
    <>
      <SideGroup headerText="技能名">
        <SideCellGroup2 />
        <SideCellGroup />
      </SideGroup>
    </>
  )
}
//

type ColumnProps = {
  headerText: string
  children: ReactNode
}

function Column({ headerText, children }: ColumnProps) {
  return (
    <>
      <div className={styles.inputBunch}>
        <div className={`${styles.inputHeaderCell} ${styles.inputCellCommon}`}>
          <b>{headerText}</b>
        </div>
        {children}
      </div>
    </>
  )
}

//
type aaa = {
  text: string
  disabled?: boolean
}

function TestColumn({ text, disabled = false }: aaa) {
  return (
    <>
      <Column headerText={text}>
        <InputCell value="" disabled={disabled} />
        <InputCell value="" disabled={disabled} />
        <InputCell value="" disabled={disabled} />
        <InputCell value="" disabled={disabled} />
        <InputCell value="" disabled={disabled} />
      </Column>
    </>
  )
}

export function TestTable() {
  return (
    <>
      <div className={styles.widthWrap}>
        <div className={styles.tableWrap}>
          <TestSideGroup />
          <TestColumn text="初期値" disabled={true} />
          <TestColumn text="職業P" />
          <TestColumn text="興味P" />
          <TestColumn text="その他" />
          <TestColumn text="合計" disabled={true} />
          <TestButtonColumn text="" />
        </div>
      </div>
    </>
  )
}

function TestButtonColumn({ text }: aaa) {
  return (
    <>
      <Column headerText={text}>
        <ButtonCell />
        <ButtonCell />
        <ButtonCell />
        <ButtonCell />
        <ButtonCell />
      </Column>
    </>
  )
}

//

type ButtonCellProps = {
  clickHandler?: () => void
}

function ButtonCell({ clickHandler }: ButtonCellProps) {
  return (
    <>
      <div className={`${styles.inputCell} ${styles.inputCellCommon}`}>
        <div className={styles.inputCellInner}>
          <div className={styles.inputCellInnerInner}>
            <CloseButton onClick={clickHandler} />
          </div>
        </div>
      </div>
    </>
  )
}
