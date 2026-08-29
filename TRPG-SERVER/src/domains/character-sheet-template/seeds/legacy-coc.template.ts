import type { ConstraintSource, SheetField, SheetTemplate } from '@trpg/sheet-engine'
import { SYSTEM_TEMPLATE_AUTHOR } from '../character-sheet-template.constants'

type LegacyAbilityDefinition = {
  id: string
  uid: string
  label: string
  rollNotation: string
}

const LEGACY_COC_ABILITIES: LegacyAbilityDefinition[] = [
  { id: 'str', uid: 'lgc_str', label: 'STR', rollNotation: '3d6*5' },
  { id: 'con', uid: 'lgc_con', label: 'CON', rollNotation: '3d6*5' },
  { id: 'pow', uid: 'lgc_pow', label: 'POW', rollNotation: '3d6*5' },
  { id: 'dex', uid: 'lgc_dex', label: 'DEX', rollNotation: '3d6*5' },
  { id: 'app', uid: 'lgc_app', label: 'APP', rollNotation: '3d6*5' },
  { id: 'siz', uid: 'lgc_siz', label: 'SIZ', rollNotation: '(2d6+6)*5' },
  { id: 'int', uid: 'lgc_int', label: 'INT', rollNotation: '(2d6+6)*5' },
  { id: 'edu', uid: 'lgc_edu', label: 'EDU', rollNotation: '(2d6+6)*5' }
]

/**
 * 能力値 1 つにつき scalar を 1 本だけ作り、作成時ロールをその scalar 自身に宣言する。
 *
 * 出目は宣言した field の uid にしか書かれない（character-instantiation.service.ts の
 * applyRollOnCreate）。かつて能力値は scalar と `*_roll`（roll 型）の 2 本に分かれており、
 * 出目は roll 側へ入る一方で HP / MP / SAN の式は scalar 側を参照していた。
 * 未入力の数値 scalar は評価時に 0 へ畳まれる（evaluator.ts の numberOrZero）ため、
 * 作成直後の HP / MP / SAN が例外も警告も無いまま 0 になっていた。
 *
 * parts と role は作成時ロールとは別の関心なので残す。parts は Discord の ± が積む内訳の器で、
 * role は技能判定（1d100 以下）のパレット項目。
 */
function buildLegacyAbilityFields(): SheetField[] {
  return LEGACY_COC_ABILITIES.map((ability): SheetField => ({
    type: 'scalar',
    id: ability.id,
    uid: ability.uid,
    label: ability.label,
    valueType: 'number',
    parts: true,
    rollOnCreate: { notation: ability.rollNotation },
    role: { kind: 'rollable', notation: '1d100<={value}', group: 'ability' }
  }))
}

type LegacySkillDefinition = {
  id: string
  label: string
  /** 内訳キー `initial` の既定値。CoC6 の標準初期値で、能力値から導く 2 件（回避・母国語）だけが式になる。 */
  initial: ConstraintSource
}

/**
 * CoC6 標準の 62 技能。追加・削除・初期値の改変はしない（2026-08-22 ユーザー裁定）。
 * 正本は document/character-sheet-proposals/legacy-coc-v3-skills.md。
 *
 * 初期値に能力値を参照する式が 2 件だけ混ざる理由:
 * この seed は能力値を**パーセンタイル（原典の raw 値 × 5）**で持っている。根拠は既存 computed 式で、
 * HP = floor((CON + SIZ) / 10) が原典の (raw CON + raw SIZ) / 2 に、MP = floor(POW / 5) が raw POW に、
 * SAN = POW が raw POW × 5 に対応する。つまり raw = パーセンタイル / 5。
 * 一方で技能値はパーセンテージそのもの（目星 25 は 25%）なのでスケールしない。
 * よって「raw 能力値 × N」で決まる初期値だけ /5 を挟む必要がある。
 *   回避   : 原典 raw DEX × 2 → floor({parameter.dex} * 2 / 5)
 *   母国語 : 原典 raw EDU × 5 → {parameter.edu}（× 5 と ÷ 5 が相殺して素の参照になる）
 * 同じ換算がプールの予算式にも効く（section skill の pools を参照）。
 */
const LEGACY_COC_SKILLS: LegacySkillDefinition[] = [
  // --- 戦闘技能 ---
  { id: 'dodge', label: '回避', initial: { formula: 'floor({parameter.dex} * 2 / 5)' } },
  { id: 'kick', label: 'キック', initial: 25 },
  { id: 'grapple', label: '組み付き', initial: 25 },
  { id: 'punch', label: 'こぶし（パンチ）', initial: 50 },
  { id: 'headbutt', label: '頭突き', initial: 10 },
  { id: 'throw', label: '投擲', initial: 25 },
  { id: 'martial_arts', label: 'マーシャルアーツ', initial: 1 },
  { id: 'handgun', label: '拳銃', initial: 20 },
  { id: 'smg', label: 'サブマシンガン', initial: 15 },
  { id: 'shotgun', label: 'ショットガン', initial: 30 },
  { id: 'machinegun', label: 'マシンガン', initial: 15 },
  { id: 'rifle', label: 'ライフル', initial: 25 },
  // --- 探索技能 ---
  { id: 'first_aid', label: '応急手当', initial: 30 },
  { id: 'locksmith', label: '鍵開け', initial: 1 },
  { id: 'conceal', label: '隠す', initial: 15 },
  { id: 'hide', label: '隠れる', initial: 10 },
  { id: 'listen', label: '聞き耳', initial: 25 },
  { id: 'sneak', label: '忍び歩き', initial: 10 },
  { id: 'photography', label: '写真術', initial: 10 },
  { id: 'psychoanalysis', label: '精神分析', initial: 1 },
  { id: 'track', label: '追跡', initial: 10 },
  { id: 'climb', label: '登攀', initial: 40 },
  { id: 'library', label: '図書館', initial: 25 },
  { id: 'spot_hidden', label: '目星', initial: 25 },
  // --- 行動技能 ---
  { id: 'drive', label: '運転（自動車）', initial: 20 },
  { id: 'mech_repair', label: '機械修理', initial: 20 },
  { id: 'operate_heavy_machine', label: '重機械操作', initial: 1 },
  { id: 'ride', label: '乗馬', initial: 5 },
  { id: 'swim', label: '水泳', initial: 25 },
  { id: 'craft', label: '製作', initial: 5 },
  { id: 'pilot', label: '操縦', initial: 1 },
  { id: 'jump', label: '跳躍', initial: 25 },
  { id: 'electr_repair', label: '電気修理', initial: 10 },
  { id: 'navigate', label: 'ナビゲート', initial: 10 },
  { id: 'disguise', label: '変装', initial: 1 },
  // --- 交渉技能 ---
  { id: 'fast_talk', label: '言いくるめ', initial: 5 },
  { id: 'credit_rating', label: '信用', initial: 15 },
  { id: 'persuade', label: '説得', initial: 15 },
  { id: 'bargain', label: '値切り', initial: 5 },
  { id: 'own_language', label: '母国語', initial: { formula: '{parameter.edu}' } },
  // 「他の言語」固定 3 枠は v3 で配布済みの 62 技能 roster の一部なので、v4 でも形を変えない。
  // 任意の言語を増やす用途は後段のカスタム技能 list が担い、使わない固定枠は初期値 1 のまま残る。
  { id: 'other_language_1', label: '他の言語 1', initial: 1 },
  { id: 'other_language_2', label: '他の言語 2', initial: 1 },
  { id: 'other_language_3', label: '他の言語 3', initial: 1 },
  // --- 知識技能 ---
  { id: 'medicine', label: '医学', initial: 5 },
  { id: 'occult', label: 'オカルト', initial: 5 },
  { id: 'chemistry', label: '化学', initial: 1 },
  // クトゥルフ神話は原典では作成時に職業・興味ポイントを振れない。ハウスルールとして
  // 他技能と同じ 3 内訳キーを持たせ、振り先に含めることをユーザーが選択した（2026-08-22 裁定）。
  { id: 'cthulhu_mythos', label: 'クトゥルフ神話', initial: 0 },
  { id: 'art', label: '芸術', initial: 5 },
  { id: 'accounting', label: '経理', initial: 10 },
  { id: 'archaeology', label: '考古学', initial: 1 },
  { id: 'computer', label: 'コンピューター', initial: 1 },
  { id: 'psychology', label: '心理学', initial: 5 },
  { id: 'anthropology', label: '人類学', initial: 1 },
  { id: 'biology', label: '生物学', initial: 1 },
  { id: 'geology', label: '地質学', initial: 1 },
  { id: 'electronics', label: '電子工学', initial: 1 },
  { id: 'astronomy', label: '天文学', initial: 1 },
  { id: 'natural_history', label: '博物学', initial: 10 },
  { id: 'physics', label: '物理学', initial: 1 },
  { id: 'law', label: '法律', initial: 5 },
  { id: 'pharmacy', label: '薬学', initial: 1 },
  { id: 'history', label: '歴史', initial: 20 }
]

/**
 * 技能 1 つにつき section 直下の number scalar を 1 本作り、内訳キーを 3 種に固定する。
 *
 * この「section 直下の number scalar」という形は 2 つの条件を同時に満たすため崩せない。
 * 1 つはプールの publish 資格で、pool の partsKey は section 直下 field の宣言でしか充足できない。
 * もう 1 つは作成時の既定値の焼き込み（character-instantiation.service.ts の applyPartsDefaults）で、
 * section 直下 number scalar かつ内訳を持てる field にしか効かない。後者を外すと、初期値が式である
 * 回避と母国語だけが焼き込まれず、例外も警告も無いまま 0 のキャラが配布される。
 *
 * `parts: true` は付けない。publish が partsKeys との併用を拒否する一方（publish.ts）、
 * 内訳の可否（value-input.ts の allowsParts）は partsKeys の宣言だけで真になる。
 *
 * 技能判定は CoC の中心操作であり、role が無い技能はロールパレットから振れず手入力ダイスへ落ちる。
 * そのためクトゥルフ神話を含む全 62 本を例外なく rollable にする（2026-08-22 ユーザー裁定）。
 */
function buildLegacySkillFields(): SheetField[] {
  return LEGACY_COC_SKILLS.map((skill): SheetField => ({
    type: 'scalar',
    id: skill.id,
    // 既存 uid（能力値の `lgc_str` 等・description の `lgc_occupation` 等）と衝突させないための前缀。
    uid: `lgc_skill_${skill.id}`,
    label: skill.label,
    valueType: 'number',
    role: { kind: 'rollable', notation: '1d100<={value}', group: 'skill' },
    partsKeys: [
      { id: 'initial', label: '初期値', default: skill.initial },
      { id: 'occupation', label: '職業' },
      { id: 'interest', label: '興味' }
    ]
  }))
}

export const LEGACY_COC_TEMPLATE: SheetTemplate = {
  // カスタム技能・ステータス欄を足すために、旧 `legacy-coc-v3` の行は残したまま別 id で出し直す。
  // 版だけを上げる形は採れない。resolveReadableRevision に「Phase 2 は templateId ごとに単一バージョンのみを
  // 保持する」と明記があり、版を上げると既存キャラの pin（templateId + templateVersion）が解決できず 409 になる。
  // update 経路も published/deprecated の構造変更を
  // `published/deprecated template structure is immutable` で拒否する。
  // seeder（src/scripts/seed-legacy-coc-template.ts の decideSeedAction）は insert しか持たず、
  // 同 templateId の既存行に対しては skip / conflict を報告するだけで上書きしない。
  // さらに作成済みキャラは templateId と templateVersion を sheet へ固定保存する
  // （character-instantiation.service.ts）ため、旧行を消すと既存キャラの template 解決が壊れる。
  // 帰結として、この配布テンプレートを後から直すにも版上げではなく次の id が要る。
  templateId: 'legacy-coc-v4',
  name: 'Legacy Call of Cthulhu（能力値ロール修正版）',
  version: '1.0.0',
  schemaVersion: 3,
  // BCDice StaticLoader requires an existing system ID; an unknown ID makes creation-time rolls fail.
  gameSystemId: 'Cthulhu',
  tags: ['legacy', 'coc'],
  visibility: 'private',
  authorDiscordUserId: SYSTEM_TEMPLATE_AUTHOR,
  settings: { rounding: 'floor' },
  sections: [
    {
      id: 'parameter',
      label: 'Parameter',
      fields: buildLegacyAbilityFields()
    },
    {
      id: 'status',
      label: 'Status',
      fields: [
        {
          type: 'computed',
          id: 'hp',
          uid: 'lgc_hp',
          label: 'HP',
          resultType: 'number',
          formula: 'floor(({parameter.con} + {parameter.siz}) / 10)'
        },
        {
          type: 'computed',
          id: 'mp',
          uid: 'lgc_mp',
          label: 'MP',
          resultType: 'number',
          formula: 'floor({parameter.pow} / 5)'
        },
        {
          type: 'computed',
          id: 'san',
          uid: 'lgc_san',
          label: 'SAN',
          resultType: 'number',
          formula: '{parameter.pow}'
        },
        {
          type: 'computed',
          id: 'db',
          uid: 'lgc_db',
          label: 'DB',
          resultType: 'dice',
          formula: 'lookup({parameter.str} + {parameter.siz}, damage_bonus)'
        },
        {
          type: 'list',
          id: 'custom_status',
          uid: 'lgc_custom_status',
          label: 'カスタムステータス',
          // 行内 track の max は固定値しか宣言できず、行ごとに異なる上限を表せない。
          // 現在値と上限（目安）を number 列で持ち、TrackRangePolicy との行統合は Q-F の将来スライスに委ねる。
          // rowRole を宣言しないので行は palette にも projection にも出ず、advisory 欄の表示は Web のシート画面だけが担う。
          itemFields: [
            { type: 'scalar', id: 'name', uid: 'lgc_custom_status_name', label: '名称', valueType: 'text' },
            { type: 'scalar', id: 'value', uid: 'lgc_custom_status_value', label: '現在値', valueType: 'number' },
            {
              type: 'scalar',
              id: 'limit',
              uid: 'lgc_custom_status_limit',
              label: '上限（目安）',
              valueType: 'number'
            }
          ]
        }
      ]
    },
    {
      // section id は投影先 5 種（status / parameter / skill / item / description）の名前と一致させる。
      // 一致しない id は projection-key-validation.ts の projectionTarget が description へ寄せるため、
      // 技能が skill 投影に載らなくなる。
      id: 'skill',
      label: '技能',
      // 予算式のスケール換算は LEGACY_COC_SKILLS の Why と同じ（原典 raw EDU × 20・raw INT × 10 に対し、
      // ここの能力値は raw × 5 なので係数が 1/5 になる）。
      // partsKey は同じ section の field が宣言していなければならず、宣言が無いと publish が
      // `pool partsKey must be declared by a field in scope` で拒否する（publish.ts の validateSectionReferences）。
      // 職業技能の限定（pool.scope + blocks）は行わない。振れる技能は職業ごとのキャラ側の選択であって
      // テンプレートには書けないため、両プールとも全技能を振り先にする。
      pools: [
        { id: 'occupation', label: '職業ポイント', total: { formula: '{parameter.edu} * 4' }, partsKey: 'occupation' },
        { id: 'interest', label: '興味ポイント', total: { formula: '{parameter.int} * 2' }, partsKey: 'interest' }
      ],
      fields: [
        ...buildLegacySkillFields(),
        {
          type: 'list',
          id: 'custom_skills',
          uid: 'lgc_custom_skills',
          label: 'カスタム技能',
          itemFields: [
            { type: 'scalar', id: 'name', uid: 'lgc_custom_skill_name', label: '技能名', valueType: 'text' },
            {
              type: 'scalar',
              id: 'value',
              uid: 'lgc_custom_skill_value',
              label: '技能値',
              valueType: 'number',
              // 行の partsKey に default を書くと、行追加時点からプールを消費済みとして扱ってしまう。
              // engine publish も list item の default を拒否するため、配分値は保存された行だけから集計する。
              partsKeys: [
                { id: 'initial', label: '初期値' },
                { id: 'occupation', label: '職業' },
                { id: 'interest', label: '興味' }
              ]
            }
          ],
          // 行投影は notation の最初の row 参照を値出所にするため、`{row.value}` を唯一かつ先頭に置く。
          // 固定値 notation の行が palette には出ても投影には出ない非対称を避けるため、この順序を崩さない。
          rowRole: {
            kind: 'rollable',
            notation: '1d100<={row.value}',
            group: 'skill',
            labelSubFieldId: 'name'
          }
        }
      ]
    },
    {
      id: 'description',
      label: 'Description',
      fields: [
        { type: 'scalar', id: 'occupation', uid: 'lgc_occupation', label: 'Occupation', valueType: 'text' },
        { type: 'scalar', id: 'personality', uid: 'lgc_personality', label: 'Personality', valueType: 'text' },
        { type: 'scalar', id: 'background', uid: 'lgc_background', label: 'Background', valueType: 'text' },
        { type: 'scalar', id: 'hobby', uid: 'lgc_hobby', label: 'Hobby', valueType: 'text' },
        { type: 'scalar', id: 'note', uid: 'lgc_note', label: 'Note', valueType: 'text' }
      ]
    }
  ],
  tables: [
    {
      id: 'damage_bonus',
      resultType: 'dice',
      // LookupRow ranges require min and max, so open-ended bounds cannot be expressed.
      // A lookup miss aborts the entire template evaluation, so sentinel bounds cover the numeric domain.
      // This guarantees a row for missing inputs (evaluated as 0) and extreme manual values.
      rows: [
        { min: -999999, max: 64, result: '-2' },
        { min: 65, max: 84, result: '-1' },
        { min: 85, max: 124, result: '0' },
        { min: 125, max: 164, result: '+1d4' },
        { min: 165, max: 999999, result: '+1d6' }
      ]
    }
  ]
}

// 技能は v3 で CoC6 標準 62 本の固定枠として載せ、v4 で行追加用のカスタム技能欄を併設した（section skill）。
// 固定 62 技能の上限（scalar.max）は
// 置かない。要望の「最大値」は職業・興味ポイントというプールの予算のことで、技能個別の上限は CoC6 に無く、
// 置くと正当な高技能値へ警告が出るだけになる。
// 旧 `legacy-coc` から取り込んだキャラの技能は、引き続き design-v1 section 3 の互換投影が正本。
