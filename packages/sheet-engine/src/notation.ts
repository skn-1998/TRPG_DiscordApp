import { buildTemplateIndex, refKey, resolveRefPath } from './template-index';
import { EvaluationResult, NotationInterpolationResult, ResolvedRef, RuntimeValue, SheetTemplate } from './types';

export interface InterpolateNotationInput {
  template: SheetTemplate;
  evaluated: EvaluationResult;
  notation: string;
  value?: RuntimeValue;
  row?: Record<string, RuntimeValue>;
  parentListUid?: string;
}

export function interpolateNotation(input: InterpolateNotationInput): NotationInterpolationResult {
  const index = buildTemplateIndex(input.template);
  const refs = new Map<string, ResolvedRef>();
  let output = '';

  for (let i = 0; i < input.notation.length; i += 1) {
    const char = input.notation[i];
    if (char === '{' && input.notation[i + 1] === '{') {
      output += '{';
      i += 1;
      continue;
    }
    if (char === '}' && input.notation[i + 1] === '}') {
      output += '}';
      i += 1;
      continue;
    }
    if (char !== '{') {
      output += char;
      continue;
    }

    const end = input.notation.indexOf('}', i + 1);
    if (end < 0) {
      throw new Error('Unclosed notation token');
    }
    const token = input.notation.slice(i + 1, end).trim();
    const { sign, path } = splitSignedToken(token);
    const value = resolveNotationToken(input, path);
    if (path !== 'value') {
      const parentList = input.parentListUid ? index.listsByUid.get(input.parentListUid)?.field : undefined;
      const ref = resolveRefPath(index, path, parentList);
      refs.set(refKey(ref), ref);
    }
    output += formatNotationValue(value, sign);
    i = end;
  }

  return { notation: normalizeSigns(output), refs: Array.from(refs.values()) };
}

export function isNotationFragment(value: string): boolean {
  if (value === '') {
    return true;
  }
  if (/[{}\s;]/.test(value)) {
    return false;
  }
  return /^[+-]?(?:\d+(?:\.\d+)?|\d*d\d+)(?:[+-](?:\d+(?:\.\d+)?|\d*d\d+))*$/i.test(value);
}

function resolveNotationToken(input: InterpolateNotationInput, path: string): RuntimeValue {
  const index = buildTemplateIndex(input.template);
  if (path === 'value') {
    if (!input.value) {
      throw new Error('{value} is not available');
    }
    return input.value;
  }
  if (path.startsWith('row.')) {
    if (!input.row) {
      throw new Error(`Row notation reference is not available: ${path}`);
    }
    const subId = path.split('.')[1];
    const list = input.parentListUid ? index.listsByUid.get(input.parentListUid)?.field : undefined;
    const subUid = list?.itemFields.find((field) => field.id === subId)?.uid;
    const value = input.row[subId] ?? (subUid ? input.row[subUid] : undefined);
    if (!value) {
      throw new Error(`Missing row notation value: ${path}`);
    }
    return value;
  }

  const ref = resolveRefPath(index, path);
  if (ref.kind !== 'field') {
    throw new Error(`List aggregate cannot be interpolated directly: ${path}`);
  }
  const value = input.evaluated.values[ref.uid];
  if (!value) {
    throw new Error(`Missing notation value: ${path}`);
  }
  return value;
}

function splitSignedToken(token: string): { sign?: '+' | '-'; path: string } {
  if (token.startsWith('+') || token.startsWith('-')) {
    return { sign: token[0] as '+' | '-', path: token.slice(1).trim() };
  }
  return { path: token };
}

function formatNotationValue(value: RuntimeValue, sign?: '+' | '-'): string {
  if (value.type === 'number') {
    const numeric = Number(value.value);
    if (sign) {
      if (numeric === 0) {
        return '';
      }
      const signed = sign === '-' ? -numeric : numeric;
      return signed > 0 ? `+${signed}` : `${signed}`;
    }
    return String(numeric);
  }
  if (value.type === 'dice') {
    const fragment = String(value.value);
    if (!isNotationFragment(fragment)) {
      throw new Error(`Invalid notation fragment: ${fragment}`);
    }
    return sign ? normalizeSigns(`${sign}${fragment}`) : fragment;
  }
  throw new Error(`Notation interpolation only accepts number or notation fragment, got ${value.type}`);
}

function normalizeSigns(value: string): string {
  let next = value;
  let previous: string;
  do {
    previous = next;
    next = next.replace(/\+\+/g, '+').replace(/\+-/g, '-').replace(/-\+/g, '-').replace(/--/g, '+');
  } while (next !== previous);
  return next;
}
