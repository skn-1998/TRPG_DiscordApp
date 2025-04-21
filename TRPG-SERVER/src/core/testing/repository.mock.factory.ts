import { Repository } from '../interfaces/repository.interface';

/**
 * リポジトリモック作成のためのファクトリ
 * テストでのリポジトリのモック化を簡単にする
 */
export class RepositoryMockFactory {
  /**
   * 基本的なリポジトリのモックを作成する
   * @returns リポジトリモック
   */
  static createMock<T, ID>(): jest.Mocked<Repository<T, ID>> {
    return {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as jest.Mocked<Repository<T, ID>>;
  }

  /**
   * 空の結果を返すリポジトリモックを作成する
   * @returns 空の結果を返すリポジトリモック
   */
  static createEmptyMock<T, ID>(): jest.Mocked<Repository<T, ID>> {
    return {
      create: jest.fn().mockResolvedValue(null),
      findById: jest.fn().mockResolvedValue(null),
      findAll: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue(null),
      remove: jest.fn().mockResolvedValue(undefined),
    } as jest.Mocked<Repository<T, ID>>;
  }

  /**
   * モックデータを返すリポジトリモックを作成する
   * @param mockData モックデータ
   * @returns モックデータを返すリポジトリモック
   */
  static createMockWithData<T, ID>(mockData: T): jest.Mocked<Repository<T, ID>> {
    return {
      create: jest.fn().mockResolvedValue(mockData),
      findById: jest.fn().mockResolvedValue(mockData),
      findAll: jest.fn().mockResolvedValue([mockData]),
      update: jest.fn().mockResolvedValue(mockData),
      remove: jest.fn().mockResolvedValue(undefined),
    } as jest.Mocked<Repository<T, ID>>;
  }
} 