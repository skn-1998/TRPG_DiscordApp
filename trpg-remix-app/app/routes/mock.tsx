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
  colors: {
    base: baseColor,
    accent: accentColor
  }
})

export default function Mock() {
  return (
    <>
      <MantineProvider theme={theme}>
        <Outlet />
      </MantineProvider>
    </>
  )
}
