import { ChangeEvent, ReactElement, useState } from 'react'
import styles from './flexTable2.module.css'
import { omit } from 'lodash'

type testObj = {
  [key: string]: {
    name: string
    index: string
    value: string
    other: string
  }
}

const testData: testObj = {
  STR: {
    name: 'STR',
    index: '0',
    value: '0',
    other: '0'
  }
}

function isEmptyString(element: ChangeEvent<HTMLInputElement>) {
  return element.target.value === ''
}

export function StatusTable({ obj }: testObj) {
  const hoge = '0000000000'

  const [value, setValue] = useState('')

  const changeHandler = (e: ChangeEvent<HTMLInputElement>) => {
    const result = Number(e.target.value)
    console.log(e.target.value, result, isNaN(result), isEmptyString(e))
  }

  const changeHandler2 = (e: ChangeEvent<HTMLInputElement>) => {
    const _value = e.target.value
    setValue(_value)
  }

  return (
    <>
      <input type="number" onChange={changeHandler} defaultValue={hoge} />
      <input type="number" onChange={changeHandler2} value={value} />
      <TextBunch nameArr={testNameArr} />
      <Banana>
        <Choco />
      </Banana>
    </>
  )
}

type Props = {
  text: string
}

const testNameArr = ['STR', 'DEX', 'POW', 'APP', 'CON']

type TextBunchProps = {
  nameArr: string[]
}

function TextBunch({ nameArr }: TextBunchProps) {
  const TextCellGroup = nameArr.map((e, i) => <TextCell key={i} text={e} />)

  return (
    <>
      <div className={styles.textBunch}>
        <div className={`${styles.textHeaderCell} ${styles.inputCellCommon}`}>
          <b></b>
        </div>
        {TextCellGroup}
      </div>
    </>
  )
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
        <InputCellGroup />
      </div>
    </>
  )
}

function InputCellGroup() {
  return <></>
}

function InputCell(props: Props) {
  return (
    <>
      <div className={`${styles.inputCell} ${styles.inputCellCommon}`}>
        <div className={styles.inputCellInner}>
          <div className={styles.inputCellInnerInner}>
            <input type="number" className={styles.inputNumber} value={props.text} />
          </div>
        </div>
      </div>
    </>
  )
}

type BananaProps = {
  // children: ReactElement
  children: JSX.Element
}

function Banana({ children }: BananaProps) {
  return (
    <>
      <div>Banana</div>
      {children}
      <div>Banana</div>
    </>
  )
}

function Choco() {
  return (
    <>
      <div>Choco</div>
    </>
  )
}
