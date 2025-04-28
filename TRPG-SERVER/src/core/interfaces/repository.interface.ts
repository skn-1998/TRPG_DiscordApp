/**
 * 基本的なリポジトリインターフェース
 * テスト容易性と関心の分離のためのリポジトリパターン
 */
export interface Repository<T, ID> {
  /**
   * エンティティを作成する
   * @param entity 作成するエンティティ
   */
  create(entity: Partial<T>): Promise<T>

  /**
   * IDによってエンティティを検索する
   * @param id エンティティのID
   */
  findById(id: ID): Promise<T | null>

  /**
   * 条件に一致するすべてのエンティティを検索する
   * @param filter フィルター条件
   */
  findAll(filter?: Partial<T>): Promise<T[]>

  /**
   * エンティティを更新する
   * @param id 更新するエンティティのID
   * @param updateData 更新するデータ
   */
  update(id: ID, updateData: Partial<T>): Promise<T | null>

  /**
   * エンティティを削除する
   * @param id 削除するエンティティのID
   */
  remove(id: ID): Promise<void>
}
