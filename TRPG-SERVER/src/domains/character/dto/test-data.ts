import { CharacterInputDto } from './create-character.dto'

/**
 * 旧クトゥルフ神話TRPGのテストデータ
 */
export const cthulhuTestCharacter: CharacterInputDto = {
  characterId: 'cthulhu-test-001',
  discordUserId: '123456789012345678',
  discordChannelId: '987654321098765432',
  characterName: 'はげ田ふか男',
  gameSystemId: 'クトゥルフ神話TRPG',
  status: {
    HP: { name: 'HP', values: { base: 12 } },
    MP: { name: 'MP', values: { base: 9 } },
    SAN: { name: 'SAN', values: { base: 65 } },
    幸運: { name: '幸運', values: { base: 60 } },
    アイデア: { name: 'アイデア', values: { base: 70 } },
    知識: { name: '知識', values: { base: 55 } }
  },
  parameter: {
    STR: { name: 'STR', values: { base: 13 } },
    CON: { name: 'CON', values: { base: 12 } },
    POW: { name: 'POW', values: { base: 9 } },
    DEX: { name: 'DEX', values: { base: 14 } },
    APP: { name: 'APP', values: { base: 11 } },
    SIZ: { name: 'SIZ', values: { base: 13 } },
    INT: { name: 'INT', values: { base: 14 } },
    EDU: { name: 'EDU', values: { base: 11 } }
  },
  skill: {
    目星: { name: '目星', values: { base: 25 } },
    投擲: { name: '投擲', values: { base: 60 } },
    図書館: { name: '図書館', values: { base: 45 } },
    聞き耳: { name: '聞き耳', values: { base: 25 } },
    説得: { name: '説得', values: { base: 15 } },
    回避: { name: '回避', values: { base: 28 } },
    母国語: { name: '母国語', values: { base: 55 } },
    オカルト: { name: 'オカルト', values: { base: 35 } },
    医学: { name: '医学', values: { base: 5 } },
    クトゥルフ神話: { name: 'クトゥルフ神話', values: { base: 8 } }
  },
  item: {
    '拳銃（.38）': { name: '拳銃（.38）', description: '1d10ダメージ', values: {} },
    護符: { name: '護符', description: 'MPを1消費して呪文一つを無効化', values: {} },
    懐中電灯: { name: '懐中電灯', description: '照明、電池切れまで使用可能', values: {} },
    フィリピン爆弾: { name: 'フィリピン爆弾', description: '99個', values: {} },
    救急キット: { name: '救急キット', description: '1回のみHP1d3回復', values: {} },
    古文書: { name: '古文書', description: '一部解読済み、クトゥルフ神話+2%', values: {} }
  },
  description: {
    年齢: { name: '年齢', values: { base: 42 } },
    職業: { name: '職業', description: '考古学者', values: {} },
    性格: { name: '性格', description: '好奇心旺盛だが臆病', values: {} },
    背景: {
      name: '背景',
      description:
        '大学で古代文明を研究している。ある遺跡調査中に奇妙な石版を発見して以来、不可解な夢に悩まされている。',
      values: {}
    },
    精神的な傾向: { name: '精神的な傾向', description: '神秘的なものへの探究心と恐怖が入り混じっている', values: {} },
    趣味: { name: '趣味', description: '古書収集、チェス', values: {} },
    メモ: {
      name: 'メモ',
      description: '最近不眠症に悩まされている。部屋の片隅で何かが蠢いているような気がする。',
      values: {}
    }
  }
}
