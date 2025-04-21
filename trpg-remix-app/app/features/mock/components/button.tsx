import { Group, Button, useMantineColorScheme, useMantineTheme, DEFAULT_THEME } from '@mantine/core'


export function MockButton () {
  const { setColorScheme, clearColorScheme } = useMantineColorScheme()
  const theme = useMantineTheme()

  return (<>
    <Group>
      <Button onClick={() => console.log(DEFAULT_THEME, theme)}>Console theme Object</Button>
      <Button onClick={() => setColorScheme('light')}>Light</Button>
      <Button onClick={() => setColorScheme('dark')}>Dark</Button>
      <Button onClick={() => setColorScheme('auto')}>Auto</Button>
      <Button onClick={clearColorScheme}>Clear</Button>
    </Group>
  </>)
}
