import { Response } from 'express'
import { ApiResponseUtil } from './api-response.util'

/**
 * ApiResponseUtil は副作用として res.status().json() を呼ぶだけの薄い静的ユーティリティ。
 * 副作用の境界（Response）のみモックし、status コードと json ペイロードの形を検証する。
 * uuid / Date.now は非決定要素なので個別値ではなく型・存在のみ確認する。
 */
describe('ApiResponseUtil', () => {
  let res: { status: jest.Mock; json: jest.Mock }

  beforeEach(() => {
    // status はチェーンできるよう自身を返す
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    }
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  // 最後に json に渡ったペイロードを取得するヘルパ
  const lastJson = () => res.json.mock.calls[0][0]

  describe('success', () => {
    it('既定では status200・success=true・message=成功 で data をラップして返す', () => {
      // Arrange
      const data = { id: 1 }

      // Act
      ApiResponseUtil.success(res as unknown as Response, data, 'character')

      // Assert
      expect(res.status).toHaveBeenCalledWith(200)
      const payload = lastJson()
      expect(payload.success).toBe(true)
      expect(payload.message).toBe('成功')
      expect(payload.data).toEqual(data)
      expect(typeof payload.requestId).toBe('string')
    })

    it('status・message・meta を指定するとペイロードに反映される', () => {
      const meta = { total: 10, page: 1 }

      ApiResponseUtil.success(res as unknown as Response, [1, 2], 'character', 201, '作成しました', meta)

      expect(res.status).toHaveBeenCalledWith(201)
      const payload = lastJson()
      expect(payload.message).toBe('作成しました')
      expect(payload.meta).toEqual(meta)
      expect(payload.data).toEqual([1, 2])
    })
  })

  describe('error', () => {
    it('Error インスタンスからは message と stack を抽出する', () => {
      // Arrange
      const err = new Error('壊れた')

      // Act
      ApiResponseUtil.error(res as unknown as Response, err)

      // Assert
      expect(res.status).toHaveBeenCalledWith(500)
      const payload = lastJson()
      expect(payload.success).toBe(false)
      expect(payload.error).toBe('壊れた')
      expect(payload.message).toBe('エラーが発生しました')
    })

    it('非 Error 値は String 化して error に入れる', () => {
      ApiResponseUtil.error(res as unknown as Response, 'ただの文字列')

      const payload = lastJson()
      expect(payload.error).toBe('ただの文字列')
    })

    it('status・message・errorCode を指定すると反映される', () => {
      ApiResponseUtil.error(res as unknown as Response, new Error('x'), 422, 'カスタムメッセージ', 'MY_CODE')

      expect(res.status).toHaveBeenCalledWith(422)
      const payload = lastJson()
      expect(payload.message).toBe('カスタムメッセージ')
      expect(payload.errorCode).toBe('MY_CODE')
    })
  })

  describe('validationError', () => {
    it('status400・VALIDATION_ERROR コードで details に検証エラーを入れる', () => {
      const errors = [{ field: 'name', message: '必須です', code: 'REQUIRED' }]

      ApiResponseUtil.validationError(res as unknown as Response, errors)

      expect(res.status).toHaveBeenCalledWith(400)
      const payload = lastJson()
      expect(payload.success).toBe(false)
      expect(payload.errorCode).toBe('VALIDATION_ERROR')
      expect(payload.details).toEqual(errors)
    })
  })

  describe('authenticationError', () => {
    it('status401・AUTHENTICATION_ERROR コードを返す', () => {
      ApiResponseUtil.authenticationError(res as unknown as Response)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(lastJson().errorCode).toBe('AUTHENTICATION_ERROR')
    })

    it('message を渡すと error フィールドに反映される', () => {
      ApiResponseUtil.authenticationError(res as unknown as Response, 'トークンが無効')

      expect(lastJson().error).toBe('トークンが無効')
    })
  })

  describe('authorizationError', () => {
    it('status403・AUTHORIZATION_ERROR コードを返す', () => {
      ApiResponseUtil.authorizationError(res as unknown as Response)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(lastJson().errorCode).toBe('AUTHORIZATION_ERROR')
    })
  })

  describe('notFoundError', () => {
    it('status404・NOT_FOUND_ERROR コードで resource を error 文に埋め込む', () => {
      ApiResponseUtil.notFoundError(res as unknown as Response, 'キャラクター')

      expect(res.status).toHaveBeenCalledWith(404)
      const payload = lastJson()
      expect(payload.errorCode).toBe('NOT_FOUND_ERROR')
      expect(payload.error).toBe('キャラクターが見つかりません')
    })

    it('resource 省略時は既定の「リソース」で文を組み立てる', () => {
      ApiResponseUtil.notFoundError(res as unknown as Response)

      expect(lastJson().error).toBe('リソースが見つかりません')
    })
  })

  describe('conflictError', () => {
    it('status409・CONFLICT_ERROR コードを返す', () => {
      ApiResponseUtil.conflictError(res as unknown as Response)

      expect(res.status).toHaveBeenCalledWith(409)
      expect(lastJson().errorCode).toBe('CONFLICT_ERROR')
    })
  })

  describe('internalServerError', () => {
    it('Error からは message を抽出して status500 で返す', () => {
      ApiResponseUtil.internalServerError(res as unknown as Response, new Error('内部障害'))

      expect(res.status).toHaveBeenCalledWith(500)
      const payload = lastJson()
      expect(payload.errorCode).toBe('INTERNAL_SERVER_ERROR')
      expect(payload.error).toBe('内部障害')
    })

    it('非 Error 値は String 化して error に入れる', () => {
      ApiResponseUtil.internalServerError(res as unknown as Response, 42)

      expect(lastJson().error).toBe('42')
    })

    it('error 省略時は undefined を String 化した文字列になる', () => {
      ApiResponseUtil.internalServerError(res as unknown as Response)

      // error 未指定 → String(undefined) === 'undefined'
      expect(lastJson().error).toBe('undefined')
    })
  })

  describe('legacySuccess', () => {
    it('ラップせず素データをそのまま json で返す', () => {
      const data = { raw: true }

      ApiResponseUtil.legacySuccess(res as unknown as Response, data, 'character')

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(data)
    })

    it('status を指定するとその status で返す', () => {
      ApiResponseUtil.legacySuccess(res as unknown as Response, {}, 'character', 201)

      expect(res.status).toHaveBeenCalledWith(201)
    })
  })

  describe('legacyError', () => {
    it('success=false の素朴な envelope を返し Error の message を抽出する', () => {
      ApiResponseUtil.legacyError(res as unknown as Response, new Error('レガシー障害'))

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'エラーが発生しました',
        error: 'レガシー障害'
      })
    })

    it('非 Error 値は String 化し status・message を指定できる', () => {
      ApiResponseUtil.legacyError(res as unknown as Response, 99, 400, '不正な入力')

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: '不正な入力',
        error: '99'
      })
    })
  })
})
