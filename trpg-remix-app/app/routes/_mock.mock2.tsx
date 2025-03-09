import { Outlet } from '@remix-run/react'
import { Button, Text, TextInput, Paper, Flex } from '@mantine/core'

export default function Mock() {
  return (
    <>
      <div>mock</div>
      <Button variant="outline" color="red" size="md" radius="md">Button</Button>
      <Text c="blue.8" fz="lg">
        Card title
      </Text>
      <Text c="dimmed" fz="sm">
        Card description
      </Text>
      <TextInput label="First name" />
      <TextInput label="Last name" mt="md" />
      <Paper p="xl">My custom card</Paper>
      <Flex>
        <Button style={{ flex: 1 }}>Large button</Button>
        <Button>Small button</Button>
      </Flex>
      <Outlet />
    </>
  )
}
