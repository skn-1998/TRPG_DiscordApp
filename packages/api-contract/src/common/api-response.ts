/**
 * TRPG-SERVER の SuccessResponse（src/core/dto/api-response.dto.ts）の直列化形。
 *
 * 成功封筒化は ResponseInterceptor 適用コントローラ（auth / user / character。
 * features/character-sheet が所有する CharacterSheetController を含む）のみ。
 * 非適用コントローラ（character-sheet-template・discord 等）の成功面は素データを返す。
 * HTTP エラーは全 route で ErrorEnvelope へ封筒化するが、Express/http-errors 起源の 413 等は除く。
 * 直列化フィールド形の正典はこの契約パッケージ。
 * server 側 SuccessResponse / ErrorResponse は constructor・既定値・runtime 生成を所有し、
 * この interface 群と同形を維持する（S5 で implements により機械固定予定）。
 * フィールド変更時は両方を同時に更新する。
 */
export interface SuccessEnvelope<T> {
  success: true;
  message: string;
  timestamp: number;
  requestId?: string;
  data: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    hasNext?: boolean;
    hasPrev?: boolean;
  };
}

/**
 * TRPG-SERVER の ErrorResponse の直列化形。
 *
 * stack は development 環境でのみ載る。
 * HttpException は全 route でこの封筒へ写像する。
 * CharacterSheetController の sheet ルートは専用 filter が issues / cause に診断情報を保持する。
 * Express/http-errors 起源の 413 等が返す Nest 既定形（statusCode / message / error）と
 * ResponseInterceptor 非適用コントローラの成功面はこの型では表現しない。
 * 直列化フィールド形の正典はこの契約パッケージ。
 * server 側 SuccessResponse / ErrorResponse は constructor・既定値・runtime 生成を所有し、
 * この interface 群と同形を維持する（S5 で implements により機械固定予定）。
 * フィールド変更時は両方を同時に更新する。
 */
export interface ErrorEnvelope {
  success: false;
  message: string;
  timestamp: number;
  requestId?: string;
  error: string;
  errorCode?: string;
  details?: Array<{
    field?: string;
    message: string;
    code?: string;
  }>;
  /**
   * sheet ルートの filter が設定する非有限診断キャリア。
   */
  issues?: ReadonlyArray<{
    fieldUid?: string;
    path?: ReadonlyArray<string>;
    message: string;
  }>;
  /**
   * sheet ルートの filter が旧 HttpException body の残余情報を保持する構造化 cause キャリア。
   */
  cause?: Readonly<Record<string, unknown>>;
  stack?: string;
}

/**
 * TRPG-SERVER の SuccessResponse / ErrorResponse（src/core/dto/api-response.dto.ts）の直列化形。
 *
 * success リテラルで判別する。
 * 直列化フィールド形の正典はこの契約パッケージ。
 * server 側 SuccessResponse / ErrorResponse は constructor・既定値・runtime 生成を所有し、
 * この interface 群と同形を維持する（S5 で implements により機械固定予定）。
 * フィールド変更時は両方を同時に更新する。
 */
export type Envelope<T> = SuccessEnvelope<T> | ErrorEnvelope;
