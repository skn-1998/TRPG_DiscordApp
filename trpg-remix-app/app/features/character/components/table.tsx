import { ChangeEvent, ChangeEventHandler, ReactNode, useEffect, useState } from 'react'
import styles from './flexTable2.module.css'
import { Button, CloseButton } from '@mantine/core'
import useStore from '~/store'

type TextCellProps = {
  text: string
  isOdd?: boolean
}

function TextCell({ text, isOdd = false }: TextCellProps) {
  return (
    <>
      <div className={`${styles.textCell} ${styles.textCellCommon} ${isOdd ? styles.oddRow : ''}`}>
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
  isOdd?: boolean
}

function InputCell({ value, changeHandler, disabled = false, isOdd = false }: InputCellProps) {
  return (
    <>
      <div className={`${styles.inputCell} ${styles.inputCellCommon} ${isOdd ? styles.oddRow : ''}`}>
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
      <SideGroup headerText="hello">
        <SideCellGroup />
        <SideCellGroup2 />
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

function EmptyButtonCell() {
  return (
    <>
      <div className={`${styles.inputCell} ${styles.inputCellCommon}`}>
        <div className={styles.inputCellInner}>
          <div className={styles.inputCellInnerInner}></div>
        </div>
      </div>
    </>
  )
}

//
export function StatusTest() {
  const status = useStore((state) => state.status)
  const updateStatus = useStore((state) => state.updateStatus)

  const attrs = Object.keys(status)

  return (
    <>
      <div className={styles.widthWrap}>
        <div className={styles.tableWrap}>
          <SideGroup headerText="">
            {attrs.map((attr, i) => {
              const isOdd = i % 2 !== 0
              return <TextCell text={status[attr].name} isOdd={isOdd} />
            })}
          </SideGroup>
          <Column headerText="初期値">
            {attrs.map((attr, i) => {
              const changeHandler = (e: ChangeEvent<HTMLInputElement>) => updateStatus(attr, 'initial', e.target.value)
              const isOdd = i % 2 !== 0
              return (
                <InputCell
                  value={status[attr].values.initial}
                  disabled={false}
                  changeHandler={changeHandler}
                  isOdd={isOdd}
                />
              )
            })}
          </Column>
          <Column headerText="その他">
            {attrs.map((attr, i) => {
              const changeHandler = (e: ChangeEvent<HTMLInputElement>) => updateStatus(attr, 'other', e.target.value)
              const isOdd = i % 2 !== 0
              return (
                <InputCell
                  value={status[attr].values.other}
                  disabled={false}
                  changeHandler={changeHandler}
                  isOdd={isOdd}
                />
              )
            })}
          </Column>
          <Column headerText="合計">
            {attrs.map((attr, i) => {
              const isOdd = i % 2 !== 0
              return <SumCell isOdd={isOdd} values={[status[attr].values.initial, status[attr].values.other]} />
            })}
          </Column>
        </div>
      </div>
    </>
  )
}

type SumCellProps = {
  isOdd?: boolean
  values: string[]
}

function SumCell({ isOdd, values }: SumCellProps) {
  const [sum, setSum] = useState('0')
  useEffect(() => {
    const result = values.map((v) => Number(v)).reduce((p, c) => p + c, 0)
    setSum(`${result}`)
  }, [values])

  return (
    <>
      <InputCell value={sum} disabled isOdd={isOdd} />
    </>
  )
}

//
export function SkillTest() {
  const skill = useStore((state) => state.skill)
  const createSkill = useStore((state) => state.createSkill)
  const updateSkill = useStore((state) => state.updateSkill)
  const deleteSkill = useStore((state) => state.deleteSkill)

  const keys = Object.keys(skill)

  return (
    <>
      <Button onClick={() => createSkill()}>＋</Button>
      <div className={styles.widthWrap}>
        <div className={styles.tableWrap}>
          <SideGroup headerText="技能名">
            {keys.map((attr, i) => {
              const isOdd = i % 2 !== 0
              return <TextCell text={skill[attr].name} isOdd={isOdd} />
            })}
          </SideGroup>
          <Column headerText="初期値">
            {keys.map((attr, i) => {
              const changeHandler = (e: ChangeEvent<HTMLInputElement>) => updateSkill(attr, 'initial', e.target.value)
              const isOdd = i % 2 !== 0
              return (
                <InputCell
                  value={skill[attr].values.initial}
                  disabled={true}
                  changeHandler={changeHandler}
                  isOdd={isOdd}
                />
              )
            })}
          </Column>
          <Column headerText="職業P">
            {keys.map((attr, i) => {
              const changeHandler = (e: ChangeEvent<HTMLInputElement>) =>
                updateSkill(attr, 'occupation', e.target.value)
              const isOdd = i % 2 !== 0
              return (
                <InputCell
                  value={skill[attr].values.occupation}
                  disabled={false}
                  changeHandler={changeHandler}
                  isOdd={isOdd}
                />
              )
            })}
          </Column>
          <Column headerText="興味P">
            {keys.map((attr, i) => {
              const changeHandler = (e: ChangeEvent<HTMLInputElement>) => updateSkill(attr, 'interest', e.target.value)
              const isOdd = i % 2 !== 0
              return (
                <InputCell
                  value={skill[attr].values.interest}
                  disabled={false}
                  changeHandler={changeHandler}
                  isOdd={isOdd}
                />
              )
            })}
          </Column>
          <Column headerText="その他">
            {keys.map((attr, i) => {
              const changeHandler = (e: ChangeEvent<HTMLInputElement>) => updateSkill(attr, 'other', e.target.value)
              const isOdd = i % 2 !== 0
              return (
                <InputCell
                  value={skill[attr].values.other}
                  disabled={false}
                  changeHandler={changeHandler}
                  isOdd={isOdd}
                />
              )
            })}
          </Column>
          <Column headerText="合計">
            {keys.map((attr, i) => {
              const isOdd = i % 2 !== 0
              return (
                <SumCell
                  isOdd={isOdd}
                  values={[
                    skill[attr].values.initial,
                    skill[attr].values.occupation,
                    skill[attr].values.interest,
                    skill[attr].values.other
                  ]}
                />
              )
            })}
          </Column>
          <Column headerText="">
            {keys.map((attr) => {
              if (!skill[attr].deletable) {
                return (
                  <>
                    <EmptyButtonCell />
                  </>
                )
              }
              const clickHandler = () => deleteSkill(attr)
              return (
                <>
                  <ButtonCell clickHandler={clickHandler} />
                </>
              )
            })}
          </Column>
        </div>
      </div>
    </>
  )
}
