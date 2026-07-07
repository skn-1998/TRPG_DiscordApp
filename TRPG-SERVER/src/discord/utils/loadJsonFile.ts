import { Logger } from '@nestjs/common'
import * as fs from 'fs'

// DI 非対象の pure util のためモジュールスコープの Logger を使用（§12: 純粋層に DI を持ち込まない）
const logger = new Logger('loadJsonFile')

export function loadJsonFile(filePath: string) {
  try {
    const data = fs.readFileSync(filePath, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    logger.error('Error reading the file', error)
  }
}
