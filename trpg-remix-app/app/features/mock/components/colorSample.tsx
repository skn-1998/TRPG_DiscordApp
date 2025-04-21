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
      style={{ borderRadius: theme.radius.md }}
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

function ColorBox2 (props: { colorName: string }){
  const theme = useMantineTheme()
  const { colorName } = props
  return (<>
    <Flex
      bg={colorName}
      mih={60}
      miw={70}
      p={4}
      justify="center"
      align="center"
      direction="column"
      style={{ borderRadius: theme.radius.md }}
    >
      <Text c='white' ta="center" component="span">{`${colorName}`}</Text>
      <Text c='black' ta="center" component="span">{`${colorName}`}</Text>
    </Flex>
  </>)
}

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
  <Flex
    gap={2}
  >
    <ColorBox2 colorName='dark' />
    <ColorBox2 colorName='gray' />
    <ColorBox2 colorName='red' />
    <ColorBox2 colorName='pink' />
    <ColorBox2 colorName='grape' />
    <ColorBox2 colorName='violet' />
    <ColorBox2 colorName='indigo' />
    <ColorBox2 colorName='blue' />
    <ColorBox2 colorName='cyan' />
    <ColorBox2 colorName='teal' />
    <ColorBox2 colorName='green' />
    <ColorBox2 colorName='lime' />
    <ColorBox2 colorName='yellow' />
    <ColorBox2 colorName='orange' />
  </Flex>
  <Flex>
    <ColorBox2 colorName='test' />
  </Flex>

  </>)
}
