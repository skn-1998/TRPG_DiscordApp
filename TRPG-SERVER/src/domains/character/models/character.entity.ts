import { AttributeSection } from '../../../core/types/attribute.types'

/**
 * キャラクター公開エンティティ（plain object・E-6d）
 *
 * 🎯 責務:
 * - repository / CharacterService / イベント契約 / discord 層が扱うキャラクターの公開型
 * - Mongoose Document API（save/toObject 等）を持たない plain object であることを型で保証する
 *
 * 📏 契約:
 * - repository 境界で plain 化される（読み取り系は .lean()、create は save 後の .toObject()）。
 *   消費側で toObject ガードや Document 判定は不要。
 * - `_id` は**型としての公開契約に含めない**（永続化の内部事情）。ただし実行時の plain オブジェクトには
 *   従来互換で `_id` が残り得る（lean/toObject は除去しない・summary クエリのみ -_id 指定）。
 *   消費側は `_id` に依存しないこと（依存が必要になったら契約への昇格を検討）。
 * - 既存 DB の default 欠損レコード（旧データ）は lean 経路で schema default 補完を受けない
 *   （E-6d Codex レビュー Low。消費側は optional chaining 前提のため実害は限定的・
 *   新規作成は CharacterService.create が section を正規化して保存するため影響なし）。
 * - createdAt / updatedAt は @Schema({ timestamps: true }) により DB 側で付与される
 *   （作成入力には現れないため optional）。
 * - 永続化スキーマ定義は @Schema クラス `Character`（character.model.ts・persistence 専用）が正。
 *   フィールドを増減する場合は両者を同期させること。
 */
export interface CharacterEntity {
  characterId: string
  characterName: string
  gameSystemId: string
  discordUserId: string
  discordChannelId: string
  discordThreadId?: string
  status: AttributeSection
  skill?: AttributeSection
  parameter?: AttributeSection
  item?: AttributeSection
  description?: AttributeSection
  createdAt?: Date
  updatedAt?: Date
}
