import { PartialInputCharacterDto } from './create-character.dto'

/**
 * 旧クトゥルフ神話TRPGのテストデータ
 */
export const cthulhuTestCharacter: PartialInputCharacterDto = {
  characterId: 'cthulhu-test-001',
  discordUserId: '123456789012345678',
  discordChannelId: '987654321098765432',
  characterName: 'はげ田ふか男',
  TRPGName: 'クトゥルフ神話TRPG',
  status: {
    HP: 12,
    MP: 9,
    SAN: 65,
    幸運: 60,
    アイデア: 70,
    知識: 55
  },
  parameter: {
    STR: 13,
    CON: 12,
    POW: 9,
    DEX: 14,
    APP: 11,
    SIZ: 13,
    INT: 14,
    EDU: 11
  },
  skill: {
    目星: 25,
    投擲: 60,
    図書館: 45,
    聞き耳: 25,
    説得: 15,
    回避: 28,
    母国語: 55,
    オカルト: 35,
    医学: 5,
    クトゥルフ神話: 8
  },
  item: {
    '拳銃（.38）': '1d10ダメージ',
    護符: 'MPを1消費して呪文一つを無効化',
    懐中電灯: '照明、電池切れまで使用可能',
    フィリピン爆弾: '99個',
    救急キット: '1回のみHP1d3回復',
    古文書: '一部解読済み、クトゥルフ神話+2%'
  },
  description: {
    年齢: 42,
    職業: '考古学者',
    性格: '好奇心旺盛だが臆病',
    背景: '大学で古代文明を研究している。ある遺跡調査中に奇妙な石版を発見して以来、不可解な夢に悩まされている。',
    精神的な傾向: '神秘的なものへの探究心と恐怖が入り混じっている',
    趣味: '古書収集、チェス',
    メモ: '最近不眠症に悩まされている。部屋の片隅で何かが蠢いているような気がする。'
  }
}
