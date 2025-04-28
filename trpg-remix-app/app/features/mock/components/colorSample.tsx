import { useMantineTheme, Flex, Text, Button } from '@mantine/core'

function ColorBox(props: { colorName: string; index: number }) {
  const theme = useMantineTheme()
  const { colorName, index } = props
  const color = theme.colors[colorName][index]
  return (
    <>
      <Flex
        bg={color}
        mih={60}
        miw={70}
        maw={70}
        p={4}
        justify="center"
        align="center"
        direction="column"
        style={{ borderRadius: theme.radius.md, overflow: 'hidden' }}
        fz="sm"
      >
        <Text c="white" ta="center" component="span">{`${colorName}.${index}`}</Text>
        <Text c="black" ta="center" component="span">{`${colorName}.${index}`}</Text>
      </Flex>
    </>
  )
}

function ColorBoxBlock(props: { colorName: string }) {
  return (
    <>
      <Flex gap={2} justify="flex-start" align="center" direction="row" wrap="wrap">
        {Array.from({ length: 10 }, (_, index) => (
          <ColorBox key={index} colorName={props.colorName} index={index} />
        ))}
      </Flex>
    </>
  )
}

function ColorButton(props: { colorName: string }) {
  return (
    <>
      <Flex gap={4} justify="flex-start" align="center" direction="row" wrap="wrap">
        <Button miw={120} color={props.colorName}>
          {props.colorName}
        </Button>
        <Button miw={120} color={props.colorName} variant="outline">
          outline
        </Button>
        <Button miw={120} color={props.colorName} variant="light">
          light
        </Button>
      </Flex>
    </>
  )
}

export function ColorSample() {
  const theme = useMantineTheme()

  return (
    <>
      <Flex gap={2} justify="flex-start" align="flex-start" direction="column" wrap="wrap" p={4}>
        <ColorBoxBlock colorName="main" />
        <ColorBoxBlock colorName="accent" />
        <ColorBoxBlock colorName="sub" />
        <ColorBoxBlock colorName="comp" />
        <ColorBoxBlock colorName="subComp" />
      </Flex>
      <Flex
        gap={4}
        justify="flex-start"
        align="flex-start"
        direction="column"
        wrap="wrap"
        p={4}
        w="max-content"
        style={{ borderRadius: theme.radius.md }}
      >
        <ColorButton colorName="main" />
        <ColorButton colorName="accent" />
        <ColorButton colorName="sub" />
        <ColorButton colorName="comp" />
        <ColorButton colorName="subComp" />
      </Flex>
      <Flex
        gap={4}
        justify="flex-start"
        align="flex-start"
        direction="column"
        wrap="wrap"
        bg="main"
        p={4}
        w="max-content"
        style={{ borderRadius: theme.radius.md }}
      >
        <ColorButton colorName="accent" />
        <ColorButton colorName="sub" />
        <ColorButton colorName="comp" />
        <ColorButton colorName="subComp" />
      </Flex>
    </>
  )
}
