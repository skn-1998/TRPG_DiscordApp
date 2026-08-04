import { HttpException, HttpStatus } from '@nestjs/common'
import { CharacterAuthenticationException, CharacterNotFoundException } from './character-http.exception'

describe('CharacterAuthenticationException', () => {
  it('HttpException を継承し 401 ステータスを持つ', () => {
    const exception = new CharacterAuthenticationException('認証エラー')

    expect(exception).toBeInstanceOf(HttpException)
    expect(exception.getStatus()).toBe(HttpStatus.UNAUTHORIZED)
  })

  it('userMessage を保持し message は wire label を示す', () => {
    const exception = new CharacterAuthenticationException('ログインが必要です')

    expect(exception.userMessage).toBe('ログインが必要です')
    expect(exception.message).toBe('認証エラー')
  })
})

describe('CharacterNotFoundException', () => {
  it('HttpException を継承し 404 ステータスを持つ', () => {
    const exception = new CharacterNotFoundException('セッション')

    expect(exception).toBeInstanceOf(HttpException)
    expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND)
  })

  it('resource を保持し message は wire label を示す', () => {
    const exception = new CharacterNotFoundException('セッション')

    expect(exception.resource).toBe('セッション')
    expect(exception.message).toBe('未発見エラー')
  })
})
