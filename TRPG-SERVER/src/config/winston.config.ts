/**
 * Winston ログ設定
 * 型安全な設定値を使用してWinstonの設定を生成
 */

import { join } from 'path'
import * as winston from 'winston'
import { AppConfigService } from './config.service'
import { AppConfig } from './configuration'

/**
 * Winston設定を生成する
 * AppConfigServiceを使用して型安全な設定値を取得
 */
export const createWinstonConfig = (configService: AppConfigService) => {
  const logLevel = configService.get('logging.level')
  const fileEnabled = configService.get('logging.fileEnabled')
  const consoleEnabled = configService.get('logging.consoleEnabled')
  const filePath = configService.get('logging.filePath')
  const errorFilePath = configService.get('logging.errorFilePath')

  // ログフォーマットの定義
  const logFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, context }) => {
      return `${timestamp} [${context}] ${level}: ${message}`
    })
  )

  // コンソール用フォーマット（色付き）
  const consoleFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, context }) => {
      return `${timestamp} [${context}] ${level}: ${message}`
    })
  )

  // トランスポート設定
  const transports: winston.transport[] = []

  // コンソール出力
  if (consoleEnabled) {
    transports.push(
      new winston.transports.Console({
        level: logLevel,
        format: consoleFormat
      })
    )
  }

  // ファイル出力
  if (fileEnabled) {
    // 全てのログ
    transports.push(
      new winston.transports.File({
        filename: join(process.cwd(), filePath),
        level: logLevel,
        format: logFormat
      })
    )

    // エラーログ専用
    transports.push(
      new winston.transports.File({
        filename: join(process.cwd(), errorFilePath),
        level: 'error',
        format: logFormat
      })
    )
  }

  return {
    transports,
    level: logLevel
  }
}

/**
 * winston設定のファクトリー関数
 * NestJSのWinstonModuleで使用
 */
export const winstonConfigFactory = (configService: AppConfigService) => {
  return createWinstonConfig(configService)
}
