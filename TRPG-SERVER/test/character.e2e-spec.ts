import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import request from 'supertest'
import { cthulhuTestCharacter } from '../src/domains/character/dto/test-data'
import { JwtAuthGuard } from '../src/domains/auth/guards/jwt-auth.guard'
import { AuthGuard } from '@nestjs/passport'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Character } from '../src/domains/character/models/character.model'
import { TestAppModule } from './test-app.module'
import { mockCharacters, mockCharacterRepository } from './mocks/mock.module'

// 認証をモックするためのモックガード
class MockJwtAuthGuard {
  canActivate() {
    return true
  }
}

class MockAuthGuard {
  canActivate() {
    return true
  }
}

describe('CharacterController (e2e)', () => {
  let app: INestApplication
  let characterRepository: any
  let createdCharacterId: string = 'test-id-123'

  // テスト実行前の準備
  beforeAll(async () => {
    try {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [TestAppModule]
      })
        // 認証ガードをモックに置き換え
        .overrideGuard(JwtAuthGuard)
        .useClass(MockJwtAuthGuard)
        .overrideGuard(AuthGuard('discord'))
        .useClass(MockAuthGuard)
        .compile()

      app = moduleFixture.createNestApplication()

      // バリデーションパイプを設定
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          transform: true
        })
      )

      // キャラクターリポジトリを取得
      characterRepository = moduleFixture.get(getRepositoryToken(Character))

      await app.init()

      // テスト前にテストデータを全て削除
      mockCharacters.length = 0
    } catch (error) {
      console.error('テストのセットアップに失敗しました:', error)
      throw error
    }
  })

  // テスト実行後のクリーンアップ
  afterAll(async () => {
    // テストデータを削除
    mockCharacters.length = 0

    if (app) {
      await app.close()
    }
  })

  // 認証ユーザーをシミュレートするリクエスト変更関数
  const addAuthUserToRequest = (req: any) => {
    return req
      .set('Authorization', 'Bearer test-token')
      .set('user', JSON.stringify({ discordUserId: '123456789012345678', username: 'test-user' }))
  }

  it('POST /character - キャラクターを作成できること', async () => {
    const response = await addAuthUserToRequest(
      request(app.getHttpServer()).post('/character').send(cthulhuTestCharacter)
    )

    // レスポンスを検証
    expect(response.status).toBe(201)
    expect(response.body).toHaveProperty('characterId')
    expect(response.body.characterName).toBe(cthulhuTestCharacter.characterName)
    expect(response.body.discordUserId).toBe('123456789012345678')

    // 作成されたIDを保存（後続のテストで使用）
    createdCharacterId = response.body.characterId
  })

  it('GET /character - ユーザーのキャラクターリストを取得できること', async () => {
    const response = await addAuthUserToRequest(request(app.getHttpServer()).get('/character'))

    // レスポンスを検証
    expect(response.status).toBe(200)
    expect(Array.isArray(response.body)).toBe(true)
    expect(response.body.length).toBeGreaterThan(0)

    // 作成したキャラクターが含まれているか確認
    const foundCharacter = response.body.find((char: any) => char.characterId === createdCharacterId)
    expect(foundCharacter).toBeDefined()
    expect(foundCharacter.characterName).toBe(cthulhuTestCharacter.characterName)
  })

  it('GET /character/:id - 特定のキャラクターを取得できること', async () => {
    const response = await addAuthUserToRequest(request(app.getHttpServer()).get(`/character/${createdCharacterId}`))

    // レスポンスを検証
    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty('characterId', createdCharacterId)
    expect(response.body.characterName).toBe(cthulhuTestCharacter.characterName)
    expect(response.body.discordUserId).toBe('123456789012345678')

    // スキルとパラメータが正しく保存されているか確認
    expect(response.body.skill).toEqual(cthulhuTestCharacter.skill)
    expect(response.body.parameter).toEqual(cthulhuTestCharacter.parameter)
  })

  it('PUT /character/:id - キャラクターを更新できること', async () => {
    const updatedName = 'はげ田ふかお（更新済み）'

    const response = await addAuthUserToRequest(
      request(app.getHttpServer())
        .put(`/character/${createdCharacterId}`)
        .send({
          characterName: updatedName,
          status: {
            ...cthulhuTestCharacter.status,
            HP: { name: 'HP', values: { base: 15 } }
          }
        })
    )

    // レスポンスを検証
    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty('characterId', createdCharacterId)
    expect(response.body.characterName).toBe(updatedName)
    expect(response.body.status.HP).toBe(15)
  })

  it('DELETE /character/:id - キャラクターを削除できること', async () => {
    const response = await addAuthUserToRequest(request(app.getHttpServer()).delete(`/character/${createdCharacterId}`))

    // レスポンスを検証
    expect(response.status).toBe(200)

    // 削除されていることを確認
    const getResponse = await addAuthUserToRequest(request(app.getHttpServer()).get(`/character/${createdCharacterId}`))

    expect(getResponse.status).toBe(404)
  })
})
