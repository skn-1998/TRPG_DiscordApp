// engine dist が CJS のための interop 境界。engine 側を dual build 化したら撤去可。
import * as engine from '@trpg/sheet-engine'

export const evaluateTemplate = engine.evaluateTemplate
export const validatePublishTemplate = engine.validatePublishTemplate

export type {
  ComputedResultType,
  FieldRole,
  LookupTable,
  RoundingMode,
  RuntimeValue,
  ScalarValueType,
  SheetField,
  SheetSection,
  SheetTemplate
} from '@trpg/sheet-engine'
