import type { PublishIssue, SheetField, SheetTemplate } from './types';
import { parseExpression } from './parser';

// 個数・面数は既存 server whitelist と揃え、長さは UID/label より複雑な複合式を許容しつつ
// publish 診断と後段 BCDice 入力を有界に保つ。
const STANDALONE_ROLL_EXPRESSION_MAX_LENGTH = 256;
const STANDALONE_ROLL_LITERAL_DICE_MAX_COUNT = 100;
const STANDALONE_ROLL_DIE_MAX_SIDES = 1_000;

type StandaloneRollTokenKind =
  | 'dice'
  | 'integer'
  | 'placeholder'
  | 'plus'
  | 'minus'
  | 'multiply'
  | 'leftParen'
  | 'rightParen';

interface StandaloneRollDiceToken {
  kind: 'dice';
  diceCount: number;
  dieSides: number;
}

type StandaloneRollToken =
  | StandaloneRollDiceToken
  | { kind: Exclude<StandaloneRollTokenKind, 'dice'> };

/**
 * テンプレート内の全 RollField.notation を再帰的に静的検査する。
 *
 * placeholder は不透明な項として扱い、BCDice 固有の受理判定や展開後の負荷検査は行わない。
 * role / rowRole の notation は NotationFragment 契約のため対象に含めない。
 */
export function validateStandaloneRollNotations(template: SheetTemplate): PublishIssue[] {
  const issues: PublishIssue[] = [];

  for (const section of template.sections) {
    for (const field of section.fields) {
      collectStandaloneRollIssues(field, `${section.id}.${field.id}`, issues);
    }
  }

  return issues;
}

function collectStandaloneRollIssues(field: SheetField, path: string, issues: PublishIssue[]): void {
  if (field.type === 'roll') {
    for (const message of validateStandaloneRollExpression(field.notation)) {
      issues.push({ path: `${path}.notation`, message });
    }
    return;
  }

  if (field.type === 'list') {
    for (const itemField of field.itemFields) {
      collectStandaloneRollIssues(itemField, `${path}.${itemField.id}`, issues);
    }
    return;
  }

  if (field.type === 'relation') {
    for (const attr of field.attrs ?? []) {
      collectStandaloneRollIssues(attr, `${path}.${attr.id}`, issues);
    }
  }
}

function validateStandaloneRollExpression(notation: string): string[] {
  if (notation.trim().length === 0) {
    return ['standalone roll expression must not be empty'];
  }
  if (notation.length > STANDALONE_ROLL_EXPRESSION_MAX_LENGTH) {
    return [
      `standalone roll expression must be ${STANDALONE_ROLL_EXPRESSION_MAX_LENGTH} characters or fewer`,
    ];
  }

  let tokens: StandaloneRollToken[];
  try {
    tokens = tokenizeStandaloneRollExpression(notation);
    parseExpression(toParserSource(tokens));
  } catch {
    return ['invalid standalone roll expression'];
  }

  const diceTokens = tokens.filter(isStandaloneRollDiceToken);
  const literalDiceCount = diceTokens.reduce((total, token) => total + token.diceCount, 0);
  const maxDieSides = diceTokens.reduce((maximum, token) => Math.max(maximum, token.dieSides), 0);
  const issues: string[] = [];
  if (diceTokens.length === 0) {
    issues.push('standalone roll expression must contain at least one literal dice term');
  }
  if (diceTokens.some((token) => token.diceCount === 0)) {
    issues.push('literal dice count must be at least 1');
  } else if (literalDiceCount > STANDALONE_ROLL_LITERAL_DICE_MAX_COUNT) {
    issues.push(
      `literal dice count limit exceeded: ${literalDiceCount} > ${STANDALONE_ROLL_LITERAL_DICE_MAX_COUNT}`,
    );
  }
  if (diceTokens.some((token) => token.dieSides === 0)) {
    issues.push('die sides must be at least 1');
  } else if (maxDieSides > STANDALONE_ROLL_DIE_MAX_SIDES) {
    issues.push(
      `die side limit exceeded: ${maxDieSides} > ${STANDALONE_ROLL_DIE_MAX_SIDES}`,
    );
  }

  return issues;
}

function tokenizeStandaloneRollExpression(notation: string): StandaloneRollToken[] {
  const tokens: StandaloneRollToken[] = [];

  for (let index = 0; index < notation.length;) {
    const char = notation[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (char === '{') {
      const end = notation.indexOf('}', index + 1);
      if (end < 0 || notation.slice(index + 1, end).trim().length === 0) {
        throw new Error('invalid placeholder');
      }
      tokens.push({ kind: 'placeholder' });
      index = end + 1;
      continue;
    }

    const operatorKind = operatorTokenKind(char);
    if (operatorKind) {
      tokens.push({ kind: operatorKind });
      index += 1;
      continue;
    }

    if (char === 'd' || char === 'D' || isDigit(char)) {
      const diceToken = readDiceToken(notation, index);
      if (diceToken) {
        tokens.push(diceToken.token);
        index = diceToken.nextIndex;
        continue;
      }

      if (isDigit(char)) {
        index = readIntegerEnd(notation, index);
        tokens.push({ kind: 'integer' });
        continue;
      }
    }

    throw new Error('invalid token');
  }

  return tokens;
}

function isStandaloneRollDiceToken(token: StandaloneRollToken): token is StandaloneRollDiceToken {
  return token.kind === 'dice';
}

function toParserSource(tokens: readonly StandaloneRollToken[]): string {
  let source = '';
  let previousKind: StandaloneRollTokenKind | undefined;

  for (const token of tokens) {
    if (previousKind && endsPrimary(previousKind) && beginsPrimary(token.kind)) {
      if (previousKind !== 'placeholder' && token.kind !== 'placeholder') {
        throw new Error('operator is missing between terms');
      }
      // `1d8{derived.db}` のように placeholder と接する場合だけ暗黙連結を許可する。
      source += '*';
    }
    source += parserTokenSource(token.kind);
    previousKind = token.kind;
  }

  return source;
}

function beginsPrimary(kind: StandaloneRollTokenKind): boolean {
  return kind === 'dice' || kind === 'integer' || kind === 'placeholder' || kind === 'leftParen';
}

function endsPrimary(kind: StandaloneRollTokenKind): boolean {
  return kind === 'dice' || kind === 'integer' || kind === 'placeholder' || kind === 'rightParen';
}

function parserTokenSource(kind: StandaloneRollTokenKind): string {
  switch (kind) {
    case 'dice':
    case 'integer':
    case 'placeholder':
      return '1';
    case 'plus':
      return '+';
    case 'minus':
      return '-';
    case 'multiply':
      return '*';
    case 'leftParen':
      return '(';
    case 'rightParen':
      return ')';
  }
}

function operatorTokenKind(
  char: string,
): Exclude<StandaloneRollTokenKind, 'dice' | 'integer' | 'placeholder'> | undefined {
  switch (char) {
    case '+':
      return 'plus';
    case '-':
      return 'minus';
    case '*':
      return 'multiply';
    case '(':
      return 'leftParen';
    case ')':
      return 'rightParen';
    default:
      return undefined;
  }
}

function readDiceToken(
  notation: string,
  startIndex: number,
): { token: StandaloneRollDiceToken; nextIndex: number } | undefined {
  let index = startIndex;
  const countStart = index;
  if (isDigit(notation[index])) {
    index = readIntegerEnd(notation, index);
  }

  if (notation[index] !== 'd' && notation[index] !== 'D') {
    return undefined;
  }
  const countSource = notation.slice(countStart, index);
  index += 1;

  const sidesStart = index;
  index = readIntegerEnd(notation, index);
  if (sidesStart === index) {
    throw new Error('dice sides are missing');
  }

  return {
    token: {
      kind: 'dice',
      diceCount: countSource.length === 0 ? 1 : Number(countSource),
      dieSides: Number(notation.slice(sidesStart, index)),
    },
    nextIndex: index,
  };
}

function readIntegerEnd(notation: string, startIndex: number): number {
  let index = startIndex;
  while (index < notation.length && isDigit(notation[index])) {
    index += 1;
  }
  return index;
}

function isDigit(char: string | undefined): boolean {
  return char !== undefined && char >= '0' && char <= '9';
}
