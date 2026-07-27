import type {
  Envelope,
  ErrorEnvelope,
  SuccessEnvelope,
} from './api-response';

interface CharacterSummary {
  id: string;
}

const readResponse = (response: Envelope<CharacterSummary>): string => {
  // @ts-expect-error data は success による判別後にのみアクセスできる
  void response.data;

  if (response.success) {
    const character: CharacterSummary = response.data;
    return character.id;
  }

  const error: string = response.error;
  return error;
};

describe('Envelope', () => {
  it('success で成功封筒とエラー封筒を判別できる', () => {
    const successEnvelope: Envelope<CharacterSummary> = {
      success: true,
      message: '成功',
      timestamp: 1,
      data: { id: 'character-1' },
    };
    const errorEnvelope: Envelope<CharacterSummary> = {
      success: false,
      message: '失敗',
      timestamp: 2,
      error: 'not found',
    };

    expect(readResponse(successEnvelope)).toBe('character-1');
    expect(readResponse(errorEnvelope)).toBe('not found');
  });

  it('成功封筒の optional フィールドを保持できる', () => {
    const successEnvelope: SuccessEnvelope<CharacterSummary> = {
      success: true,
      message: '成功',
      timestamp: 3,
      requestId: 'request-1',
      data: { id: 'character-2' },
      meta: {
        total: 10,
        page: 1,
        limit: 5,
        hasNext: true,
        hasPrev: false,
      },
    };

    expect(successEnvelope).toMatchObject({
      requestId: 'request-1',
      meta: {
        total: 10,
        page: 1,
        limit: 5,
        hasNext: true,
        hasPrev: false,
      },
    });
  });

  it('エラー封筒の optional フィールドを保持できる', () => {
    const errorEnvelope: ErrorEnvelope = {
      success: false,
      message: '失敗',
      timestamp: 4,
      requestId: 'request-2',
      error: 'validation failed',
      errorCode: 'VALIDATION_ERROR',
      details: [
        {
          field: 'name',
          message: '名前は必須です',
          code: 'REQUIRED',
        },
      ],
      stack: 'Error: validation failed',
    };

    expect(errorEnvelope).toMatchObject({
      requestId: 'request-2',
      errorCode: 'VALIDATION_ERROR',
      details: [
        {
          field: 'name',
          message: '名前は必須です',
          code: 'REQUIRED',
        },
      ],
      stack: 'Error: validation failed',
    });
  });
});
