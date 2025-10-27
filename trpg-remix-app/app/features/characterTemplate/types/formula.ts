export interface ReferencePart {
  field?: string
  operator?: '+' | '-' | '*' | '/'
  value?: number
}

export interface NumberConfig {
  diceFormula?: string
  operation?: '+' | '-' | '*' | '/'
  referenceParts?: ReferencePart[]
}
