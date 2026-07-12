import type { CharacterSheetProjection } from '../types/character-sheet.types'

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
      index: 2,
      values: { base: 55 },
      isVisible: true
    },
    pow: {
      name: 'POW',
      index: 4,
      values: { base: 60 },
      isVisible: true
    },
    dex: {
      name: 'DEX',
      index: 6,
      values: { base: 65 },
      isVisible: true
    },
    app: {
      name: 'APP',
      index: 8,
      values: { base: 70 },
      isVisible: true
    },
    siz: {
      name: 'SIZ',
      index: 10,
      values: { base: 60 },
      isVisible: true
    },
    int: {
      name: 'INT',
      index: 12,
      values: { base: 75 },
      isVisible: true
    },
    edu: {
      name: 'EDU',
      index: 14,
      values: { base: 80 },
      isVisible: true
    }
  },
  skill: {},
  item: {},
  description: {}
} satisfies CharacterSheetProjection
