import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, UpdateQuery, UpdateWithAggregationPipeline } from 'mongoose'
import { Repository } from 'src/core/interfaces/repository.interface'
import { CHARACTER_MODEL, CharacterDocument, UpdatePrimary } from '../models/character.model'
import {
  CharacterEntity,
  CharacterHubTransition,
  CharacterTemplatePin,
  LegacyCharacterEntity,
  MaterializedCharacterEntity,
  SaveSheetMaterializedPayload
} from '../models/character.entity'
import { assertCharacterHubTransition } from '../models/character.entity'
import { CharacterSummaryDto } from '../dto/character-summary.dto'
import { AttributeSection, isAttributeSection } from '../../../core/types/attribute.types'
import { normalizePersistedCharacterAttributes } from '../mappers/character-attribute.mapper'
import { normalizePersistedCharacterSheet, normalizeSheetVisibilityValue } from '../mappers/character-sheet-read.mapper'
import {
  materializedCharacterEntitySchema,
  saveSheetMaterializedPayloadSchema,
  characterTemplatePinSchema,
  characterHubSchema
} from '../schemas/character.zod'

/**
 * キャラクターリポジトリの実装
 */
@Injectable()
export class CharacterRepository implements Repository<LegacyCharacterEntity, string> {
  constructor(
    @InjectModel(CHARACTER_MODEL)
    private readonly characterModel: Model<CharacterDocument>
  ) {}

  private normalizeCharacter(character: CharacterEntity | null): CharacterEntity | null {
    if (character === null) return null
    return normalizePersistedCharacterSheet(normalizePersistedCharacterAttributes(character))
  }

  private normalizeCharacters(characters: CharacterEntity[]): CharacterEntity[] {
    let changed = false
    const normalized = characters.map((character) => {
      const result = normalizePersistedCharacterSheet(normalizePersistedCharacterAttributes(character))
      changed ||= result !== character
      return result
    })
    return changed ? normalized : characters
  }

  private assertCanonicalProjection(
    projection: Pick<CharacterEntity, 'status' | 'parameter' | 'skill' | 'item' | 'description'>
  ): void {
    for (const sectionName of ['status', 'parameter', 'skill', 'item', 'description'] as const) {
      if (!isAttributeSection(projection[sectionName])) {
        throw new TypeError(`Invalid ${sectionName}: expected AttributeSection canonical form`)
      }
    }
  }

  private assertLegacyWrite(data: Partial<CharacterEntity>): void {
    const forbiddenFields = [
      'sheet',
      'templatePin',
      'computedCache',
      'palette',
      'hub',
      'appliedInteractionIds'
    ] as const
    const forbiddenField = forbiddenFields.find((field) => Object.prototype.hasOwnProperty.call(data, field))
    if (forbiddenField !== undefined) {
      throw new TypeError(`Legacy write cannot update ${forbiddenField}`)
    }
  }

  private prepareLegacyWrite(data: Partial<LegacyCharacterEntity>): Partial<LegacyCharacterEntity> {
    this.assertLegacyWrite(data)
    const prepared: Partial<LegacyCharacterEntity> = Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined)
    )

    for (const sectionName of ['status', 'parameter', 'skill', 'item', 'description'] as const) {
      if (Object.prototype.hasOwnProperty.call(prepared, sectionName) && !isAttributeSection(prepared[sectionName])) {
        throw new TypeError(`Invalid ${sectionName}: expected AttributeSection canonical form`)
      }
    }

    return prepared
  }

  /**
   * Mixed型の5セクションは通常updateだとMongooseが深く展開するため、pipelineでトップレベル置換する。
   * $literal は説明文やdiceが `$` で始まっても集約式として評価させないために必要。
   */
  private buildLegacyUpdate(
    data: Partial<LegacyCharacterEntity>
  ): UpdateQuery<CharacterDocument> | UpdateWithAggregationPipeline {
    const prepared = this.prepareLegacyWrite(data)
    const sectionNames = ['status', 'parameter', 'skill', 'item', 'description'] as const
    const replacesSection = sectionNames.some((sectionName) =>
      Object.prototype.hasOwnProperty.call(prepared, sectionName)
    )
    if (!replacesSection) return { $set: prepared }

    const pipeline: UpdateWithAggregationPipeline = [
      {
        $set: Object.fromEntries(Object.entries(prepared).map(([key, value]) => [key, { $literal: value }]))
      }
    ]

    return pipeline
  }

  /**
   * キャラクターを作成する
   * @param entity キャラクターデータ
   * @returns plain object（E-6d: repository 境界で Document を露出しない）
   */
  async create(entity: Partial<LegacyCharacterEntity>): Promise<CharacterEntity> {
    const prepared = this.prepareLegacyWrite(entity)
    const createdCharacter = new this.characterModel(prepared)
    const saved = await createdCharacter.save()
    return this.normalizeCharacter(saved.toObject())!
  }

  /**
   * sheet とその全 materialized view を単一ドキュメントとして作成する。
   */
  async createMaterializedCharacter(entity: MaterializedCharacterEntity): Promise<CharacterEntity> {
    this.assertCanonicalProjection(entity)
    materializedCharacterEntitySchema.parse(entity)
    const createdCharacter = new this.characterModel(entity)
    const saved = await createdCharacter.save()
    return this.normalizeCharacter(saved.toObject())!
  }

  /**
   * revision CAS 付きで sheet と全 materialized view を一括保存する。
   * null は revision 競合または対象不在を表す。
   */
  async saveSheetMaterialized(
    characterId: string,
    payload: SaveSheetMaterializedPayload,
    expectedRevision: number
  ): Promise<CharacterEntity | null> {
    this.assertCanonicalProjection(payload)
    saveSheetMaterializedPayloadSchema.parse(payload)
    if (payload.pendingRevision !== expectedRevision + 1) {
      throw new TypeError('pendingRevision must equal expectedRevision + 1')
    }
    const appliedInteractionIds = payload.appliedInteractionIds.slice(-20)
    const character = await this.characterModel
      .findOneAndUpdate(
        { characterId, 'sheet.revision': expectedRevision },
        {
          $set: {
            'sheet.values': payload.values,
            computedCache: payload.computedCache,
            palette: payload.palette,
            status: payload.status,
            parameter: payload.parameter,
            skill: payload.skill,
            item: payload.item,
            description: payload.description,
            'hub.pendingRevision': payload.pendingRevision,
            appliedInteractionIds
          },
          $inc: { 'sheet.revision': 1 }
        },
        { new: true }
      )
      .lean()
      .exec()
    return this.normalizeCharacter(character)
  }

  /** legacy-unpinned の character にだけ軽量 template pin を確立する。 */
  async setTemplatePin(characterId: string, pin: CharacterTemplatePin): Promise<CharacterEntity | null> {
    characterTemplatePinSchema.parse(pin)
    const character = await this.characterModel
      .findOneAndUpdate(
        { characterId, sheet: { $exists: false }, templatePin: { $exists: false } },
        { $set: { templatePin: pin } },
        { new: true }
      )
      .lean()
      .exec()
    return this.normalizeCharacter(character)
  }

  /** hub の from 条件を満たす場合だけ、to で指定した hub フィールドへ遷移する。 */
  async setHubState(
    characterId: string,
    from: CharacterHubTransition,
    to: CharacterHubTransition
  ): Promise<CharacterEntity | null> {
    characterHubSchema.parse(from)
    characterHubSchema.parse(to)
    assertCharacterHubTransition(from, to)
    const filter = Object.fromEntries(
      Object.entries(from)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [`hub.${key}`, value])
    )
    const update = Object.fromEntries(
      Object.entries(to)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [`hub.${key}`, value])
    )
    const character = await this.characterModel
      .findOneAndUpdate({ characterId, ...filter }, { $set: update }, { new: true })
      .lean()
      .exec()
    return this.normalizeCharacter(character)
  }

  /**
   * IDによってキャラクターを検索する（インデックス最適化済み）
   * @param id キャラクターID
   */
  async findById(id: string): Promise<CharacterEntity | null> {
    return this.normalizeCharacter(await this.characterModel.findOne({ characterId: id }).lean().exec())
  }

  /**
   * 所有者条件付きでキャラクターを検索する（HTTP公開操作用）
   */
  async findByIdForOwner(id: string, discordUserId: string): Promise<CharacterEntity | null> {
    return this.normalizeCharacter(await this.characterModel.findOne({ characterId: id, discordUserId }).lean().exec())
  }

  /**
   * キャラクター名で検索する（インデックス最適化済み）
   * @param name キャラクター名
   */
  async findByName(name: string): Promise<CharacterEntity | null> {
    const character = await this.characterModel
      .findOne({ characterName: name })
      .select('characterId characterName gameSystemId discordUserId discordChannelId status createdAt updatedAt')
      .lean()
      .exec()
    return this.normalizeCharacter(character)
  }

  /**
   * ChannelIDによってキャラクターを検索する（インデックス最適化済み）
   * @param channelId DiscordチャンネルID
   */
  async findByChannelId(channelId: string): Promise<CharacterEntity | null> {
    // S-1: スレッド内のダイス/技能/能力ロールは channelId からキャラを引いて
    // status/skill/parameter/gameSystemId を再解決するため、projection に含める。
    const character = await this.characterModel
      .findOne({ discordChannelId: channelId })
      .select(
        'characterId characterName discordChannelId attributes primaryAttributes status skill parameter gameSystemId palette discordUserId hub.status createdAt updatedAt'
      )
      .lean()
      .exec()
    return this.normalizeCharacter(character)
  }

  /**
   * 条件に一致するすべてのキャラクターを検索する
   * @param filter フィルター条件
   */
  async findAll(filter?: Partial<CharacterEntity>): Promise<CharacterEntity[]> {
    const characters = await this.characterModel
      .find(filter || {})
      .lean()
      .exec()
    return this.normalizeCharacters(characters)
  }

  /**
   * ユーザーが所有するすべてのキャラクターを検索する（更新日順）
   * @param discordUserId DiscordユーザーID
   */
  async findByUserId(discordUserId: string): Promise<CharacterEntity[]> {
    const characters = await this.characterModel.find({ discordUserId }).sort({ updatedAt: -1 }).lean().exec()
    return this.normalizeCharacters(characters)
  }

  /**
   * キャラクターを更新する
   * @param id キャラクターID
   * @param updateData 更新するデータ
   */
  async update(id: string, updateData: Partial<LegacyCharacterEntity>): Promise<CharacterEntity | null> {
    const update = this.buildLegacyUpdate(updateData)
    return this.normalizeCharacter(
      await this.characterModel.findOneAndUpdate({ characterId: id }, update, { new: true }).lean().exec()
    )
  }

  /**
   * 所有者条件付きでキャラクターを更新する（HTTP公開操作用）
   */
  async updateForOwner(
    id: string,
    discordUserId: string,
    updateData: Partial<LegacyCharacterEntity>
  ): Promise<CharacterEntity | null> {
    const update = this.buildLegacyUpdate(updateData)
    const character = await this.characterModel
      .findOneAndUpdate({ characterId: id, discordUserId }, update, { new: true })
      .lean()
      .exec()
    return this.normalizeCharacter(character)
  }

  /**
   * チャンネルIDによってキャラクターを更新する
   * @param channelId DiscordチャンネルID
   * @param updateData 更新するデータ
   */
  async updateByChannelId(
    channelId: string,
    updateData: Partial<LegacyCharacterEntity>
  ): Promise<CharacterEntity | null> {
    const update = this.buildLegacyUpdate(updateData)
    const character = await this.characterModel
      .findOneAndUpdate({ discordChannelId: channelId }, update, { new: true })
      .lean()
      .exec()
    return this.normalizeCharacter(character)
  }

  /**
   * 特定のフィールドを更新する
   * @param id キャラクターID
   * @param field 更新するフィールド
   * @param data 更新するデータ
   */
  async updateField(id: string, field: UpdatePrimary, data: AttributeSection): Promise<CharacterEntity | null> {
    if (!isAttributeSection(data)) {
      throw new TypeError(`Invalid ${field}: expected AttributeSection canonical form`)
    }
    const updateData = { [field]: data }
    return this.update(id, updateData)
  }

  /**
   * チャンネルIDによって特定のフィールドを更新する
   * @param channelId DiscordチャンネルID
   * @param field 更新するフィールド
   * @param data 更新するデータ
   */
  async updateFieldByChannelId(
    channelId: string,
    field: UpdatePrimary,
    data: AttributeSection
  ): Promise<CharacterEntity | null> {
    if (!isAttributeSection(data)) {
      throw new TypeError(`Invalid ${field}: expected AttributeSection canonical form`)
    }
    const updateData = { [field]: data }
    return this.updateByChannelId(channelId, updateData)
  }

  /**
   * キャラクターを削除する
   * @param id キャラクターID
   */
  async remove(id: string): Promise<CharacterEntity | null> {
    return this.normalizeCharacter(await this.characterModel.findOneAndDelete({ characterId: id }).lean().exec())
  }

  /**
   * 所有者条件付きでキャラクターを削除する（HTTP公開操作用）
   */
  async removeForOwner(id: string, discordUserId: string): Promise<CharacterEntity | null> {
    return this.normalizeCharacter(
      await this.characterModel.findOneAndDelete({ characterId: id, discordUserId }).lean().exec()
    )
  }

  /**
   * チャンネルIDによってキャラクターを削除する
   * @param channelId DiscordチャンネルID
   */
  async removeByChannelId(channelId: string): Promise<void> {
    await this.characterModel.deleteOne({ discordChannelId: channelId }).exec()
  }

  /**
   * ユーザーが所有するキャラクターの軽量データのみを取得する（データベースレベルで最適化）
   * @param discordUserId DiscordユーザーID
   */
  async findUserCharacterSummaries(discordUserId: string): Promise<CharacterSummaryDto[]> {
    // MongoDBのプロジェクション機能を使用して必要なフィールドのみを取得
    const summaries = await this.characterModel
      .find({ discordUserId })
      .select(
        'characterId characterName gameSystemId sheet.templateVersion sheet.visibility templatePin.templateVersion hub.status -_id'
      ) // 必要なフィールドのみ選択、_idは除外
      .lean() // Mongoose Document ではなく Plain Object を返す（メモリ効率化）
      .exec()

    return summaries.map((summary) => {
      const templateVersion = summary.sheet?.templateVersion ?? summary.templatePin?.templateVersion
      return {
        characterId: summary.characterId,
        characterName: summary.characterName,
        gameSystemId: summary.gameSystemId,
        visibility: normalizeSheetVisibilityValue(summary.sheet?.visibility),
        ...(templateVersion === undefined ? {} : { templateVersion }),
        ...(summary.hub?.status === undefined ? {} : { hub: { status: summary.hub.status } })
      }
    })
  }

  /**
   * キャラクターIDの存在確認
   * @param characterId キャラクターID
   * @returns 存在する場合はtrue
   */
  async existsById(characterId: string): Promise<boolean> {
    const count = await this.characterModel.countDocuments({ characterId }).exec()
    return count > 0
  }

  /**
   * チャンネル内でのキャラクターIDの存在確認
   * @param characterId キャラクターID
   * @param channelId DiscordチャンネルID
   * @returns 存在する場合はtrue
   */
  async existsByIdAndChannel(characterId: string, channelId: string): Promise<boolean> {
    const count = await this.characterModel
      .countDocuments({
        characterId,
        discordChannelId: channelId
      })
      .exec()
    return count > 0
  }

  /**
   * チャンネル内でのキャラクター名の存在確認
   * @param characterName キャラクター名
   * @param channelId DiscordチャンネルID
   * @returns 存在する場合はtrue
   */
  async existsByNameAndChannel(characterName: string, channelId: string): Promise<boolean> {
    const count = await this.characterModel
      .countDocuments({
        characterName,
        discordChannelId: channelId
      })
      .exec()
    return count > 0
  }

  /**
   * ユーザーが所有するキャラクター名の存在確認
   * @param characterName キャラクター名
   * @param discordUserId DiscordユーザーID
   * @returns 存在する場合はtrue
   */
  async existsByNameAndUser(characterName: string, discordUserId: string): Promise<boolean> {
    const count = await this.characterModel
      .countDocuments({
        characterName,
        discordUserId
      })
      .exec()
    return count > 0
  }
}
