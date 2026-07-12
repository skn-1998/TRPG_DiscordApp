import { AstNode, BinaryOperator } from './ast';

type Token =
  | { type: 'number'; value: number }
  | { type: 'string'; value: string }
  | { type: 'boolean'; value: boolean }
  | { type: 'identifier'; value: string }
  | { type: 'ref'; value: string }
  | { type: 'operator'; value: BinaryOperator }
  | { type: 'paren'; value: '(' | ')' }
  | { type: 'comma' }
  | { type: 'eof' };

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < source.length) {
    const char = source[i];
    if (/\s/.test(char)) {
      i += 1;
      continue;
    }

    if (char === '{') {
      const end = source.indexOf('}', i + 1);
      if (end < 0) {
        throw new Error('Unclosed reference token');
      }
      const value = source.slice(i + 1, end).trim();
      if (!value) {
        throw new Error('Empty reference token');
      }
      tokens.push({ type: 'ref', value });
      i = end + 1;
      continue;
    }

    if (char === '"' || char === "'") {
      const quote = char;
      let value = '';
      i += 1;
      while (i < source.length && source[i] !== quote) {
        if (source[i] === '\\') {
          i += 1;
          if (i >= source.length) {
            throw new Error('Invalid string escape');
          }
        }
        value += source[i];
        i += 1;
      }
      if (source[i] !== quote) {
        throw new Error('Unclosed string literal');
      }
      tokens.push({ type: 'string', value });
      i += 1;
      continue;
    }

    if (/\d|\./.test(char)) {
      const match = source.slice(i).match(/^(?:\d+(?:\.\d*)?|\.\d+)/);
      if (!match) {
        throw new Error(`Invalid number at ${i}`);
      }
      tokens.push({ type: 'number', value: Number(match[0]) });
      i += match[0].length;
      continue;
    }

    if (/[A-Za-z_]/.test(char)) {
      const match = source.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*/);
      if (!match) {
        throw new Error(`Invalid identifier at ${i}`);
      }
      if (match[0] === 'true' || match[0] === 'false') {
        tokens.push({ type: 'boolean', value: match[0] === 'true' });
      } else {
        tokens.push({ type: 'identifier', value: match[0] });
      }
      i += match[0].length;
      continue;
    }

    const two = source.slice(i, i + 2);
    const twoOperator = toBinaryOperator(two);
    if (twoOperator) {
      tokens.push({ type: 'operator', value: twoOperator });
      i += 2;
      continue;
    }
    const operator = toBinaryOperator(char);
    if (operator) {
      tokens.push({ type: 'operator', value: operator });
      i += 1;
      continue;
    }
    if (char === '(' || char === ')') {
      tokens.push({ type: 'paren', value: char });
      i += 1;
      continue;
    }
    if (char === ',') {
      tokens.push({ type: 'comma' });
      i += 1;
      continue;
    }

    throw new Error(`Unexpected character "${char}" at ${i}`);
  }

  tokens.push({ type: 'eof' });
  return tokens;
}

function toBinaryOperator(value: string): BinaryOperator | undefined {
  switch (value) {
    case '+':
    case '-':
    case '*':
    case '/':
    case '==':
    case '!=':
    case '<':
    case '<=':
    case '>':
    case '>=':
      return value;
    default:
      return undefined;
  }
}

export function parseExpression(source: string): AstNode {
  return new Parser(tokenize(source)).parse();
}

class Parser {
  private index = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): AstNode {
    const expression = this.parseComparison();
    this.expect('eof');
    return expression;
  }

  private parseComparison(): AstNode {
    let node = this.parseAdditive();
    let operator = this.matchOperator('==', '!=', '<', '<=', '>', '>=');
    while (operator) {
      const right = this.parseAdditive();
      node = { type: 'binary', operator: operator.value, left: node, right };
      operator = this.matchOperator('==', '!=', '<', '<=', '>', '>=');
    }
    return node;
  }

  private parseAdditive(): AstNode {
    let node = this.parseMultiplicative();
    let operator = this.matchOperator('+', '-');
    while (operator) {
      const right = this.parseMultiplicative();
      node = { type: 'binary', operator: operator.value, left: node, right };
      operator = this.matchOperator('+', '-');
    }
    return node;
  }

  private parseMultiplicative(): AstNode {
    let node = this.parseUnary();
    let operator = this.matchOperator('*', '/');
    while (operator) {
      const right = this.parseUnary();
      node = { type: 'binary', operator: operator.value, left: node, right };
      operator = this.matchOperator('*', '/');
    }
    return node;
  }

  private parseUnary(): AstNode {
    const operator = this.matchOperator('+', '-');
    if (operator) {
      return { type: 'unary', operator: operator.value, argument: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): AstNode {
    const token = this.advance();
    switch (token.type) {
      case 'number':
        return { type: 'number', value: token.value };
      case 'string':
        return { type: 'string', value: token.value };
      case 'boolean':
        return { type: 'boolean', value: token.value };
      case 'ref':
        return { type: 'ref', path: token.value };
      case 'identifier':
        if (this.matchParen('(')) {
          const args: AstNode[] = [];
          if (!this.checkParen(')')) {
            do {
              args.push(this.parseComparison());
            } while (this.matchComma());
          }
          this.consumeParen(')', 'Expected ")" after function arguments');
          return { type: 'call', name: token.value, args };
        }
        return { type: 'tableName', name: token.value };
      case 'paren':
        if (token.value === '(') {
          const expression = this.parseComparison();
          this.consumeParen(')', 'Expected ")" after expression');
          return expression;
        }
        break;
    }
    throw new Error(`Unexpected token ${token.type}`);
  }

  private matchOperator<T extends BinaryOperator>(...operators: T[]): { type: 'operator'; value: T } | undefined {
    const token = this.peek();
    if (token.type !== 'operator') {
      return undefined;
    }
    for (const operator of operators) {
      if (token.value === operator) {
        this.advance();
        return { type: 'operator', value: operator };
      }
    }
    return undefined;
  }

  private matchParen(value: '(' | ')'): boolean {
    const token = this.peek();
    if (token.type !== 'paren' || token.value !== value) {
      return false;
    }
    this.advance();
    return true;
  }

  private checkParen(value: '(' | ')'): boolean {
    const token = this.peek();
    return token.type === 'paren' && token.value === value;
  }

  private consumeParen(value: '(' | ')', message: string): void {
    if (!this.matchParen(value)) {
      throw new Error(message);
    }
  }

  private matchComma(): boolean {
    if (this.peek().type !== 'comma') {
      return false;
    }
    this.advance();
    return true;
  }

  private expect(type: Token['type']): void {
    if (this.peek().type !== type) {
      throw new Error(`Expected ${type}`);
    }
    this.advance();
  }

  private advance(): Token {
    if (this.index < this.tokens.length) {
      this.index += 1;
    }
    return this.previous();
  }

  private previous(): Token {
    return this.tokens[this.index - 1];
  }

  private peek(): Token {
    return this.tokens[this.index];
  }
}
