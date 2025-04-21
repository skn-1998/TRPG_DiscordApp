import { registerAs } from '@nestjs/config';
import { env } from './environment';

/**
 * アプリケーション全体の設定
 */
export const AppConfig = registerAs('app', () => ({
  /**
   * アプリケーション環境
   */
  environment: env.NODE_ENV,
  
  /**
   * サーバーポート
   */
  port: env.PORT,
  
  /**
   * フロントエンドのURL
   */
  frontendUrl: env.FRONTEND_URL,
})); 