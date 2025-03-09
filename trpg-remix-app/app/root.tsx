import { Links, Meta, Outlet, Scripts, ScrollRestoration } from '@remix-run/react'
import { MantineColorsTuple, MantineProvider, createTheme } from '@mantine/core'
import '@mantine/core/styles.css'
import './styles/globals.css'

const colorBlack: MantineColorsTuple = [
  '#eef3ff',
  '#dbdfea',
  '#c8ccd5',
  '#b5b8c0',
  '#a2a4ab',
  '#8e9196',
  '#7b7d81',
  '#68696c',
  '#555657',
  '#424242'
]
const colorWhite: MantineColorsTuple = [
  '#5f7cb8',
  '#718bc0',
  '#8399c8',
  '#94a8d0',
  '#a6b6d8',
  '#b8c5df',
  '#cad3e7',
  '#dbe2ef',
  '#edf0f7',
  '#ffffff'
]
const colorAccent: MantineColorsTuple = [
  '#2d4b81',
  '#334987',
  '#3a478d',
  '#404593',
  '#474399',
  '#4d429f',
  '#5440a5',
  '#5a3eab',
  '#613cb1',
  '#673ab7'
]

const theme = createTheme({
  colors: {
    black: colorBlack,
    white: colorWhite,
    accent: colorAccent
  }
})

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <MantineProvider theme={theme}>{children}</MantineProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  return <Outlet />
}
