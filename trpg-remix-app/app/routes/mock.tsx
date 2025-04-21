import { Outlet } from '@remix-run/react'
import { MantineProvider, createTheme, MantineColorsTuple } from '@mantine/core'

const baseColor: MantineColorsTuple = [
  "#f4f6f5",
  "#e9e9e9",
  "#cfd0d0",
  "#b2b8b5",
  "#99a39e",
  "#88968f",
  "#7f8f87",
  "#6c7c74",
  "#5e6f66",
  "#4d6057"
]

const mainColor: MantineColorsTuple = [
  "#f5f5f5",
  "#e7e7e7",
  "#cdcdcd",
  "#b2b2b2",
  "#9a9a9a",
  "#8b8b8b",
  "#848484",
  "#717171",
  "#656565",
  "#575757"
]

const accentColor: MantineColorsTuple = [
  '#f5eeff',
  '#e4dbf6',
  '#c6b3e7',
  '#a68ad9',
  '#8b67cd',
  '#7b50c5',
  '#7245c3',
  '#6137ac',
  '#56309b',
  '#4a2889'
]

const theme = createTheme({
  primaryColor: 'accent',
  colors: {
    base: baseColor,
    main: mainColor,
    accent: accentColor
  }
})

export default function Mock() {
  return (
    <>
      <MantineProvider theme={theme} defaultColorScheme="dark">
        <Outlet />
      </MantineProvider>
    </>
  )
}
