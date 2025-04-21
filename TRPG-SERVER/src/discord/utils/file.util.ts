import * as fs from 'fs';
import * as path from 'path';

/**
 * JSONファイルを読み込む
 * @param filePath JSONファイルのパス
 * @returns 読み込んだJSONオブジェクト
 */
export function loadJsonFile<T>(filePath: string): T {
  try {
    const fullPath = path.resolve(filePath);
    const fileContent = fs.readFileSync(fullPath, 'utf8');
    return JSON.parse(fileContent) as T;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`JSONファイルの読み込みに失敗しました: ${error.message}`);
    }
    throw error;
  }
}

/**
 * JSONファイルを書き込む
 * @param filePath 書き込み先のパス
 * @param data 書き込むデータ
 */
export function saveJsonFile<T>(filePath: string, data: T): void {
  try {
    const fullPath = path.resolve(filePath);
    const dirPath = path.dirname(fullPath);
    
    // ディレクトリが存在しない場合は作成
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    
    const jsonString = JSON.stringify(data, null, 2);
    fs.writeFileSync(fullPath, jsonString, 'utf8');
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`JSONファイルの書き込みに失敗しました: ${error.message}`);
    }
    throw error;
  }
}

/**
 * オブジェクトをJSON文字列に変換する
 * @param obj 変換するオブジェクト
 * @returns JSON文字列
 */
export function convertToJson<T>(obj: T): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`JSONへの変換に失敗しました: ${error.message}`);
    }
    throw error;
  }
} 