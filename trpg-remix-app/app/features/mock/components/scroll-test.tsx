import { Box, Flex, Text, getGradient, useMantineTheme } from '@mantine/core'

const textEN = `Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.`
const textJP = `あのイーハトーヴォのすきとおった風、夏でも底に冷たさをもつ青いそら、うつくしい森で飾られたモリーオ市、郊外のぎらぎらひかる草の波。`

export function ScrollTest() {
  const theme = useMantineTheme()
  const gradientString = getGradient({ from: 'pink', to: 'blue', deg: 180 }, theme)
  const items = Array.from({ length: 100 }, (_, i) => (
    <Text key={i} fz="h3">
      {i % 2 === 0 ? textEN : textJP}
    </Text>
  ))

  return (
    <>
      <Flex gap="md" justify="center" align="stretch" direction="row">
        <Box w={20} bg={gradientString} style={{ borderRadius: '8px' }} />
        <Box>{items}</Box>
      </Flex>
    </>
  )
}
