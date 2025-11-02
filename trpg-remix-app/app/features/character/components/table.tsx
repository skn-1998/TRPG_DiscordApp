import { ChangeEventHandler, ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import styles from './table.module.css'
import { CloseButton } from '@mantine/core'

type TextCellProps = {
  text: string
}

export function TextCell({ text }: TextCellProps) {
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
  defaultValue: string
  changeHandler?: ChangeEventHandler<HTMLInputElement>
  disabled?: boolean
  dispatch?: (value: string) => void
  value?: string
}

export function InputCell({ defaultValue, dispatch, disabled = false }: InputCellProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    console.log(defaultValue)
  }, [defaultValue])

  const changeHandler = () => {
    console.log(inputRef.current?.value)
    const value = inputRef.current?.value
    if (value !== undefined && dispatch) dispatch(value)
  }

  return (
    <>
      <div className={`${styles.inputCell} ${styles.inputCellCommon}`}>
        <div className={styles.inputCellInner}>
          <div className={styles.inputCellInnerInner}>
            <input
              type="number"
              className={styles.inputNumber}
              onChange={changeHandler}
              // value={value}
              defaultValue={defaultValue}
              ref={inputRef}
              disabled={disabled}
            />
          </div>
        </div>
      </div>
    </>
  )
}

export function SideInputCell({ value, changeHandler }: InputCellProps) {
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

export function SideGroup({ headerText, children }: SideGroupProps) {
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

type ColumnProps = {
  headerText: string
  children: ReactNode
}

export function Column({ headerText, children }: ColumnProps) {
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

type ButtonCellProps = {
  clickHandler?: () => void
}

export function ButtonCell({ clickHandler }: ButtonCellProps) {
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
