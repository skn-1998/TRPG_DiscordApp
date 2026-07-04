import { apiClient } from '~/lib/api-client'

export async function logoutUser(): Promise<void> {
  await apiClient.post('/auth/logout')
}

export async function testCookies(): Promise<void> {
  await apiClient.get('/users')
}
