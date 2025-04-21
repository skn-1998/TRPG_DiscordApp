import { useMantineTheme, Flex, Text } from '@mantine/core'

function ColorBox (props: { colorName: string, index: number }){
  const theme = useMantineTheme()
  const { colorName, index } = props
  return (<>
    <Flex
      bg={theme.colors[colorName][index]}
      mih={60}
      miw={70}
      p={4}
      justify="center"
      align="center"
      direction="column"
      style={{ borderRadius: theme.radius.sm }}
    >
      <Text c='white' ta="center" component="span">{`${colorName}.${index}`}</Text>
      <Text c='black' ta="center" component="span">{`${colorName}.${index}`}</Text>
    </Flex>
  </>)
}

function ColorBoxBlock (props: {colorName: string}) {
  return (<>
  <Flex
    gap={2}
    justify="flex-start"
    align="center"
    direction="row"
    wrap="wrap"
  >
    {Array.from({ length: 10 }, (_, index) => (<ColorBox key={index} colorName={props.colorName} index={index} />))}
  </Flex>
  </>)
}

const baseColorBox = (<ColorBoxBlock colorName='base' />)
const mainColorBox = (<ColorBoxBlock colorName='main' />)
const accentColorBox = (<ColorBoxBlock colorName='accent' />)

export function ColorSample () {
  return (<>
  <Flex
    gap={2}
    justify="flex-start"
    align="flex-start"
    direction="column"
    wrap="wrap"
  >
    {baseColorBox}
    {mainColorBox}
    {accentColorBox}
  </Flex>

  </>)
}
