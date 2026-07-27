/**
 * TRPG-SERVER の SuccessResponse（src/core/dto/api-response.dto.ts）の直列化形。
 *
 * 封筒化は ResponseInterceptor 適用コントローラ（auth / user / character）のみ。
 * 非適用コントローラ（CharacterSheetController・character-sheet-template・discord 等）は素データを返す。
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
 * 非封筒面の Nest 既定エラー形（statusCode / message / error）はこの型では表現しない。
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
