import type { CharacterSheetProjection } from '../types/character-sheet.types'

/**
 * legacy-coc テンプレートを materialize した投影の golden。値そのものの互換性を固定する。
 *
 * parameter の index は 2026-08-19 に 0,2,4,…,14 から 0..7 へ詰めた。index は
 * `sectionIndex * 1000 + fieldIndex`（sheet-materializer.service.ts）で、seed が能力値ごとに
 * 持っていた `*_roll` field を畳んだぶんだけ間隔が縮んだもの。表示順は変わらず、
 * name / values / dice / isVisible も 1 件も動いていない。
 * 値が動いたときは互換性の退行なので、ここを合わせて緑にしてはならない。
 */
export const REPRESENTATIVE_LEGACY_CHARACTER_PROJECTION = {
  status: {
    hp: {
      name: 'HP',
      index: 1000,
      values: { base: 11 },
      isVisible: true
    },
    mp: {
      name: 'MP',
      index: 1001,
      values: { base: 12 },
      isVisible: true
    },
    san: {
      name: 'SAN',
      index: 1002,
      values: { base: 60 },
      isVisible: true
    },
    db: {
      name: 'DB',
      index: 1003,
      dice: '0',
      isVisible: true
    }
  },
  parameter: {
    str: {
      name: 'STR',
      index: 0,
      values: { base: 50 },
      isVisible: true
    },
    con: {
      name: 'CON',
      index: 1,
      values: { base: 55 },
      isVisible: true
    },
    pow: {
      name: 'POW',
      index: 2,
      values: { base: 60 },
      isVisible: true
    },
    dex: {
      name: 'DEX',
      index: 3,
      values: { base: 65 },
      isVisible: true
    },
    app: {
      name: 'APP',
      index: 4,
      values: { base: 70 },
      isVisible: true
    },
    siz: {
      name: 'SIZ',
      index: 5,
      values: { base: 60 },
      isVisible: true
    },
    int: {
      name: 'INT',
      index: 6,
      values: { base: 75 },
      isVisible: true
    },
    edu: {
      name: 'EDU',
      index: 7,
      values: { base: 80 },
      isVisible: true
    }
  },
  skill: {},
  item: {},
  description: {}
} satisfies CharacterSheetProjection
