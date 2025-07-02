// COC Character Stats
export interface COCStats {
  str: number // 筋力 STR
  con: number // 体力 CON
  pow: number // 意思力 POW
  dex: number // 敏捷性 DEX
  app: number // 外見 APP
  siz: number // サイズ SIZ
  int: number // 知力 INT
  edu: number // 教育 EDU
}

// COC Character Skills
export interface COCSkills {
  // 戦闘スキル
  dodge: number
  fist: number
  grapple: number
  handgun: number
  rifle: number
  shotgun: number
  smg: number
  throw: number

  // 対人スキル
  charm: number
  fastTalk: number
  intimidate: number
  persuade: number
  psychology: number

  // 知識スキル
  accounting: number
  anthropology: number
  archaeology: number
  architecture: number
  art: number
  astronomy: number
  biology: number
  chemistry: number
  computerUse: number
  economics: number
  electronics: number
  geology: number
  history: number
  law: number
  library: number
  linguistics: number
  mathematics: number
  medicine: number
  naturalWorld: number
  occult: number
  physics: number
  psychoanalysis: number

  // 身体スキル
  climb: number
  drive: number
  electricalRepair: number
  firstAid: number
  jump: number
  mechanicalRepair: number
  operateHeavyMachinery: number
  pilot: number
  ride: number
  stealth: number
  swim: number

  // 精神スキル
  listen: number
  spotHidden: number

  // サバイバルスキル
  animalHandling: number
  navigation: number
  survival: number
  track: number
}

// COC Stats Modifiers
export interface COCStatsModifiers {
  strBonus: number
  conBonus: number
  powBonus: number
  dexBonus: number
  appBonus: number
  sizBonus: number
  intBonus: number
  eduBonus: number
  strTemp: number
  conTemp: number
  powTemp: number
  dexTemp: number
  appTemp: number
  sizTemp: number
  intTemp: number
  eduTemp: number
}

// COC Character Form Data
export interface COCCharacterForm {
  // 基本情報
  name: string
  age: number
  gender: string
  occupation: string
  birthplace: string
  residence: string
  description: string

  // 背景設定
  backstory: string
  personalData: string
  importantPersons: string
  importantPlaces: string
  treasuredPossessions: string
  traits: string

  // ゲームデータ
  stats: COCStats
  statsModifiers: COCStatsModifiers
  skills: COCSkills
}

// Derived Stats
export interface COCDerivedStats {
  hp: number // 耐久力 (CON + SIZ) / 2
  mp: number // マジックポイント POW
  san: number // 正気度 POW
  idea: number // アイデア INT * 5
  luck: number // 幸運 POW * 5
  know: number // 知識 EDU * 5
  db: string // ダメージボーナス
}
