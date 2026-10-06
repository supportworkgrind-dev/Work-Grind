import * as FormulaFunctions from '@formulajs/formulajs';

export type FormulaSheet = { title: string; data: string[][] };
export type FormulaValue = string | number | boolean | null | FormulaValue[];

type Token = { type: 'number' | 'string' | 'identifier' | 'reference' | 'operator' | 'punctuation'; value: string };

const functionMap: Record<string, (...args: unknown[]) => unknown> = {
  SUM: (...args) => Reflect.apply(FormulaFunctions.SUM, undefined, args),
  AVERAGE: (...args) => Reflect.apply(FormulaFunctions.AVERAGE, undefined, args),
  IF: (...args) => Reflect.apply(FormulaFunctions.IF, undefined, args),
  IFERROR: (...args) => args[0],
  COUNT: (...args) => Reflect.apply(FormulaFunctions.COUNT, undefined, args),
  COUNTA: (...args) => Reflect.apply(FormulaFunctions.COUNTA, undefined, args),
  COUNTIF: (...args) => Reflect.apply(FormulaFunctions.COUNTIF, undefined, args),
  SUMIF: (...args) => Reflect.apply(FormulaFunctions.SUMIF, undefined, args),
  VLOOKUP: (...args) => Reflect.apply(FormulaFunctions.VLOOKUP, undefined, args),
  INDEX: (...args) => Reflect.apply(FormulaFunctions.INDEX, undefined, args),
  MATCH: (...args) => Reflect.apply(FormulaFunctions.MATCH, undefined, args),
  TEXT: (...args) => Reflect.apply(FormulaFunctions.TEXT, undefined, args),
  DATE: (...args) => Reflect.apply(FormulaFunctions.DATE, undefined, args),
  MIN: (...args) => Reflect.apply(FormulaFunctions.MIN, undefined, args),
  MAX: (...args) => Reflect.apply(FormulaFunctions.MAX, undefined, args),
  ROUND: (...args) => Reflect.apply(FormulaFunctions.ROUND, undefined, args),
  ROUNDUP: (...args) => Reflect.apply(FormulaFunctions.ROUNDUP, undefined, args),
  ROUNDDOWN: (...args) => Reflect.apply(FormulaFunctions.ROUNDDOWN, undefined, args),
  ABS: (...args) => Reflect.apply(FormulaFunctions.ABS, undefined, args),
  AND: (...args) => Reflect.apply(FormulaFunctions.AND, undefined, args),
  OR: (...args) => Reflect.apply(FormulaFunctions.OR, undefined, args),
  NOT: (...args) => Reflect.apply(FormulaFunctions.NOT, undefined, args),
  CONCATENATE: (...args) => Reflect.apply(FormulaFunctions.CONCATENATE, undefined, args),
  CONCAT: (...args) => flatten(args).map((value) => String(value ?? '')).join(''),
  LEFT: (...args) => Reflect.apply(FormulaFunctions.LEFT, undefined, args),
  RIGHT: (...args) => Reflect.apply(FormulaFunctions.RIGHT, undefined, args),
  MID: (...args) => Reflect.apply(FormulaFunctions.MID, undefined, args),
  LEN: (...args) => Reflect.apply(FormulaFunctions.LEN, undefined, args),
  TODAY: (...args) => Reflect.apply(FormulaFunctions.TODAY, undefined, args),
  NOW: (...args) => Reflect.apply(FormulaFunctions.NOW, undefined, args),
  LOWER: (...args) => Reflect.apply(FormulaFunctions.LOWER, undefined, args),
  UPPER: (...args) => Reflect.apply(FormulaFunctions.UPPER, undefined, args),
  TRIM: (...args) => Reflect.apply(FormulaFunctions.TRIM, undefined, args),
  YEAR: (...args) => Reflect.apply(FormulaFunctions.YEAR, undefined, args),
  MONTH: (...args) => Reflect.apply(FormulaFunctions.MONTH, undefined, args),
  DAY: (...args) => Reflect.apply(FormulaFunctions.DAY, undefined, args),
  XLOOKUP: (...args) => {
    const [lookupValue, lookupArray, returnArray, notFound = '#N/A'] = args;
    const lookups = flatten(lookupArray);
    const returns = flatten(returnArray);
    const foundAt = lookups.findIndex((value) => value === lookupValue);
    return foundAt < 0 ? notFound : returns[foundAt] ?? '#N/A';
  },
  UNIQUE: (...args) => {
    const values = Array.isArray(args[0]) ? args[0] : [[args[0]]];
    const seen = new Set<string>();
    return values.filter((row) => {
      const key = JSON.stringify(row);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  },
  SORT: (...args) => {
    const values = Array.isArray(args[0]) ? args[0] : [[args[0]]];
    const columnIndex = Math.max(1, Number(args[1] ?? 1)) - 1;
    const direction = Number(args[2] ?? 1) < 0 ? -1 : 1;
    if (!values.every(Array.isArray) || values.some((row) => columnIndex >= row.length)) {
      throw new Error('SORT requires a rectangular range and a valid sort column.');
    }
    return [...values].sort((left, right) => {
      const a = left[columnIndex];
      const b = right[columnIndex];
      const numericA = Number(a);
      const numericB = Number(b);
      const bothNumbers = a !== '' && b !== '' && Number.isFinite(numericA) && Number.isFinite(numericB);
      const comparison = bothNumbers
        ? numericA - numericB
        : String(a ?? '').localeCompare(String(b ?? ''), undefined, { sensitivity: 'base', numeric: true });
      return comparison * direction;
    });
  },
  FILTER: (...args) => {
    const values = Array.isArray(args[0]) ? args[0] : [[args[0]]];
    const include = flatten(args[1]);
    const result = values.filter((_, index) => Boolean(include[index]));
    return result.length ? result : args[2] ?? '#CALC!';
  },
};

export const formulaFunctionNames = Object.keys(functionMap);

function tokenize(formula: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < formula.length) {
    const rest = formula.slice(index);
    const error = /^#(?:REF!|DIV\/0!|VALUE!|NAME\?|NUM!|N\/A|NULL!|CALC!)/i.exec(rest);
    if (error) {
      tokens.push({ type: 'identifier', value: error[0] });
      index += error[0].length;
      continue;
    }
    const whitespace = /^\s+/.exec(rest);
    if (whitespace) {
      index += whitespace[0].length;
      continue;
    }
    const string = /^"((?:[^"]|"")*)"/.exec(rest);
    if (string) {
      tokens.push({ type: 'string', value: string[1].replace(/""/g, '"') });
      index += string[0].length;
      continue;
    }
    const sheetName = /^'((?:[^']|'')+)'/.exec(rest);
    if (sheetName) {
      tokens.push({ type: 'identifier', value: sheetName[1].replace(/''/g, "'") });
      index += sheetName[0].length;
      continue;
    }
    const cell = /^\$?[A-Z]{1,3}\$?[1-9]\d*/i.exec(rest);
    if (cell) {
      tokens.push({ type: 'reference', value: cell[0] });
      index += cell[0].length;
      continue;
    }
    const number = /^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i.exec(rest);
    if (number) {
      tokens.push({ type: 'number', value: number[0] });
      index += number[0].length;
      continue;
    }
    const identifier = /^[A-Z_][A-Z0-9_.]*/i.exec(rest);
    if (identifier) {
      tokens.push({ type: 'identifier', value: identifier[0] });
      index += identifier[0].length;
      continue;
    }
    const operator = /^(?:<=|>=|<>|[+\-*/^&=<>])/.exec(rest);
    if (operator) {
      tokens.push({ type: 'operator', value: operator[0] });
      index += operator[0].length;
      continue;
    }
    const punctuation = /^[(),:!%]/.exec(rest);
    if (punctuation) {
      tokens.push({ type: 'punctuation', value: punctuation[0] });
      index += punctuation[0].length;
      continue;
    }
    throw new Error('Formula contains an unsupported character.');
  }
  return tokens;
}

function columnIndex(reference: string): number {
  const letters = reference.replace(/\$/g, '').match(/^[A-Z]+/i)?.[0]?.toUpperCase() ?? '';
  let value = 0;
  for (const letter of letters) value = value * 26 + letter.charCodeAt(0) - 64;
  return value - 1;
}

function rowIndex(reference: string): number {
  return Number(reference.replace(/\$/g, '').match(/\d+$/)?.[0] ?? '1') - 1;
}

function scalar(value: FormulaValue): FormulaValue {
  while (Array.isArray(value)) value = value[0] ?? '';
  return value;
}

function flatten(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [value];
  return value.flatMap((item) => flatten(item));
}

function numeric(value: FormulaValue): number {
  const item = scalar(value);
  if (item === '' || item === null) return 0;
  const result = Number(item);
  if (!Number.isFinite(result)) throw new Error('A formula operand is not a number.');
  return result;
}

function mapBinary(
  left: FormulaValue,
  right: FormulaValue,
  calculate: (leftValue: FormulaValue, rightValue: FormulaValue) => FormulaValue,
): FormulaValue {
  if (Array.isArray(left)) {
    return left.map((value, index) => mapBinary(
      value,
      Array.isArray(right) ? right[index] ?? '' : right,
      calculate,
    ));
  }
  if (Array.isArray(right)) return right.map((value) => mapBinary(left, value, calculate));
  return calculate(left, right);
}

function compare(leftValue: FormulaValue, rightValue: FormulaValue, operator: string): boolean {
  const left = scalar(leftValue);
  const right = scalar(rightValue);
  const numericLeft = Number(left);
  const numericRight = Number(right);
  const bothNumbers = left !== '' && right !== '' && Number.isFinite(numericLeft) && Number.isFinite(numericRight);
  const a: string | number = bothNumbers ? numericLeft : String(left ?? '').toLowerCase();
  const b: string | number = bothNumbers ? numericRight : String(right ?? '').toLowerCase();
  if (operator === '=') return a === b;
  if (operator === '<>') return a !== b;
  if (operator === '<') return a < b;
  if (operator === '>') return a > b;
  if (operator === '<=') return a <= b;
  return a >= b;
}

function evaluateTokens(
  tokens: Token[],
  currentSheet: FormulaSheet,
  sheets: FormulaSheet[],
  cache: Map<string, FormulaValue>,
  stack: Set<string>,
  getCell: (sheet: FormulaSheet, row: number, column: number) => FormulaValue,
): FormulaValue {
  let cursor = 0;
  let operations = 0;
  const peek = () => tokens[cursor];
  const take = () => tokens[cursor++];

  const readReference = (): { sheet: FormulaSheet; reference: string; sheetSpecified: boolean } | null => {
    let sheet = currentSheet;
    let sheetSpecified = false;
    let referenceToken = peek();
    if (referenceToken?.type === 'identifier' && tokens[cursor + 1]?.value === '!') {
      const requestedName = take().value;
      take();
      sheet = sheets.find((item) => item.title.toLowerCase() === requestedName.toLowerCase())!;
      if (!sheet) throw new Error(`Unknown sheet “${requestedName}”.`);
      sheetSpecified = true;
      referenceToken = peek();
    }
    if (referenceToken?.type !== 'reference') return null;
    const reference = take().value;
    return { sheet, reference, sheetSpecified };
  };

  const precedence: Record<string, number> = {
    '=': 1, '<>': 1, '<': 1, '>': 1, '<=': 1, '>=': 1,
    '&': 2, '+': 3, '-': 3, '*': 4, '/': 4, '^': 5,
  };

  const parseExpression = (minimum = 0): FormulaValue => {
    if (++operations > 5000) throw new Error('Formula is too complex to calculate.');
    let left = parsePrimary();
    while (peek()?.type === 'operator' && (precedence[peek().value] ?? 0) >= minimum) {
      const operator = take().value;
      const level = precedence[operator];
      const right = parseExpression(level + (operator === '^' ? 0 : 1));
      left = mapBinary(left, right, (leftValue, rightValue) => {
        if (level === 1) return compare(leftValue, rightValue, operator);
        if (operator === '&') return `${scalar(leftValue) ?? ''}${scalar(rightValue) ?? ''}`;
        if (operator === '+') return numeric(leftValue) + numeric(rightValue);
        if (operator === '-') return numeric(leftValue) - numeric(rightValue);
        if (operator === '*') return numeric(leftValue) * numeric(rightValue);
        if (operator === '/') {
          if (numeric(rightValue) === 0) throw new Error('Division by zero.');
          return numeric(leftValue) / numeric(rightValue);
        }
        if (operator === '^') return numeric(leftValue) ** numeric(rightValue);
        return '';
      });
    }
    return left;
  };

  const parsePrimary = (): FormulaValue => {
    const token = peek();
    if (!token) throw new Error('Formula is incomplete.');
    if (token.value === '+' || token.value === '-') {
      take();
      const value = numeric(parsePrimary());
      return token.value === '-' ? -value : value;
    }
    if (token.type === 'number') {
      take();
      return Number(token.value);
    }
    if (token.type === 'string') {
      take();
      return token.value;
    }
    if (token.value === '(') {
      take();
      const value = parseExpression();
      if (take()?.value !== ')') throw new Error('Formula is missing a closing parenthesis.');
      return value;
    }

    const savedCursor = cursor;
    const reference = readReference();
    if (reference) {
      if (peek()?.value === ':') {
        take();
        const end = readReference();
        if (!end || (end.sheetSpecified && end.sheet !== reference.sheet)) throw new Error('Invalid cell range.');
        const startRow = rowIndex(reference.reference);
        const endRow = rowIndex(end.reference);
        const startColumn = columnIndex(reference.reference);
        const endColumn = columnIndex(end.reference);
        if (endRow - startRow > 499 || endColumn - startColumn > 99) throw new Error('Formula range is too large.');
        return Array.from({ length: Math.max(0, endRow - startRow + 1) }, (_, row) =>
          Array.from({ length: Math.max(0, endColumn - startColumn + 1) }, (_, column) =>
            getCell(reference.sheet, startRow + row, startColumn + column),
          ),
        );
      }
      return getCell(reference.sheet, rowIndex(reference.reference), columnIndex(reference.reference));
    }
    cursor = savedCursor;

    if (token.type === 'identifier') {
      const name = take().value.toUpperCase();
      if (name.startsWith('#')) return name;
      if (peek()?.value === '(') {
        take();
        if (name === 'IFERROR') {
          let first: FormulaValue = '';
          let failed = false;
          try {
            first = parseExpression();
          } catch {
            failed = true;
          }
          if (peek()?.value !== ',') throw new Error('IFERROR expects two arguments.');
          take();
          const fallback = parseExpression();
          if (take()?.value !== ')') throw new Error('IFERROR is missing a closing parenthesis.');
          const checked = scalar(first);
          const isError = typeof checked === 'string' &&
            /^#(?:ERROR|REF|VALUE|DIV\/0|N\/A|NAME|NUM|NULL|CYCLE|CALC)!?/i.test(checked);
          return failed || isError ? fallback : first;
        }
        const args: FormulaValue[] = [];
        if (peek()?.value !== ')') {
          do {
            args.push(parseExpression());
            if (peek()?.value !== ',') break;
            take();
          } while (true);
        }
        if (take()?.value !== ')') throw new Error(`${name} is missing a closing parenthesis.`);
        if (name === 'IF') {
          if (args.length < 2 || args.length > 3) throw new Error('IF expects two or three arguments.');
          const condition = scalar(args[0]);
          const truthy = typeof condition === 'string'
            ? condition !== '' && condition.toUpperCase() !== 'FALSE'
            : Boolean(condition);
          return truthy ? args[1] : args[2] ?? false;
        }
        const fn = functionMap[name];
        if (!fn) throw new Error(`Unsupported function: ${name}.`);
        const result = fn(...args);
        if (result instanceof Error) throw new Error(result.message);
        if (typeof result === 'number' && !Number.isFinite(result)) throw new Error('Formula result is not finite.');
        return result as FormulaValue;
      }
      if (name === 'TRUE') return true;
      if (name === 'FALSE') return false;
      throw new Error(`Unknown name: ${name}.`);
    }
    throw new Error('Formula could not be parsed.');
  };

  const value = parseExpression();
  if (cursor !== tokens.length) throw new Error('Formula contains unexpected text.');
  return value;
}

export function evaluateSheet(
  activeSheet: FormulaSheet,
  sheets: FormulaSheet[],
): Map<string, FormulaValue> {
  const cache = new Map<string, FormulaValue>();
  const activeValues = new Map<string, FormulaValue>();
  const spillValues = new Map<string, FormulaValue>();
  const stack = new Set<string>();

  const getCell = (sheet: FormulaSheet, row: number, column: number): FormulaValue => {
    if (row < 0 || column < 0) return '';
    const raw = sheet.data[row]?.[column] ?? '';
    if (!raw.startsWith('=')) {
      const spilled = spillValues.get(`${sheet.title.toLowerCase()}:${row}:${column}`);
      if (spilled !== undefined) return spilled;
      const number = Number(raw);
      return raw !== '' && Number.isFinite(number) ? number : raw;
    }
    const key = `${sheet.title.toLowerCase()}:${row}:${column}`;
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    if (stack.has(key) || stack.size > 100) return '#CYCLE!';
    stack.add(key);
    try {
      let result = evaluateTokens(tokenize(raw.slice(1)), sheet, sheets, cache, stack, getCell);
      if (Array.isArray(result)) {
        const blocked = result.some((values, rowOffset) =>
          (Array.isArray(values) ? values : [values]).some((_, columnOffset) => {
            if (!rowOffset && !columnOffset) return false;
            const spillRow = row + rowOffset;
            const spillColumn = column + columnOffset;
            return (sheet.data[spillRow]?.[spillColumn] ?? '') !== '' ||
              spillValues.has(`${sheet.title.toLowerCase()}:${spillRow}:${spillColumn}`);
          }),
        );
        if (blocked) {
          result = '#SPILL!';
        } else {
          result.forEach((values, rowOffset) => {
            (Array.isArray(values) ? values : [values]).forEach((value, columnOffset) => {
              if (!rowOffset && !columnOffset) return;
              spillValues.set(`${sheet.title.toLowerCase()}:${row + rowOffset}:${column + columnOffset}`, value);
            });
          });
        }
      }
      cache.set(key, result);
      return result;
    } catch (error) {
      const result = `#ERROR: ${error instanceof Error ? error.message : 'Invalid formula'}`;
      cache.set(key, result);
      return result;
    } finally {
      stack.delete(key);
    }
  };

  for (let row = 0; row < activeSheet.data.length; row += 1) {
    for (let column = 0; column < (activeSheet.data[row]?.length ?? 0); column += 1) {
      const value = getCell(activeSheet, row, column);
      const raw = activeSheet.data[row]?.[column] ?? '';
      if (raw.startsWith('=')) activeValues.set(`${activeSheet.title.toLowerCase()}:${row}:${column}`, value);
    }
  }
  return new Map([...activeValues, ...spillValues]);
}
